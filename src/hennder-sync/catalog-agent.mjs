import { readFileSync } from "node:fs";
import process from "node:process";
import pg from "pg";

const WRITE_CHUNK_SIZE = 500;
const PRODUCT_ID_COLUMNS = ["idproduto", "produto_id"];
const STOCK_COLUMNS = [
  "estoqueatual",
  "estoque_atual",
  "saldoestoque",
  "saldo_estoque",
  "estoque",
  "saldo",
  "quantidadeestoque",
  "quantidade_estoque",
  "quantidade",
];
const RESERVED_COLUMNS = ["estoquereservado", "estoque_reservado", "reservado", "quantidadereservada"];

loadEnvFile(".env.local");
loadEnvFile(".env");

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.UNIPLUS_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("UNIPLUS_DATABASE_URL nao configurado no ambiente do Hennder Sync.");
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: parseBoolean(process.env.UNIPLUS_SSL) ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    const schema = await discoverCatalogSchema(client);
    const query = buildCatalogQuery(schema);
    const startedAt = Date.now();
    const result = await client.query(query);
    const syncedAt = new Date().toISOString();
    const products = result.rows.map((row) => mapCatalogProduct(row, syncedAt));

    if (apply) {
      await upsertCatalog(products);
      await removeStaleCatalogProducts(syncedAt);
    }

    process.stdout.write(`${JSON.stringify({
      dryRun: !apply,
      products: products.length,
      durationMs: Date.now() - startedAt,
      productSource: `${schema.product.schema}.${schema.product.table}`,
      stockSource: schema.stock.direct
        ? `${schema.product.schema}.${schema.product.table}.${schema.stock.quantity}`
        : `${schema.stock.schema}.${schema.stock.table}.${schema.stock.quantity}`,
      syncedAt,
    }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

async function discoverCatalogSchema(client) {
  const result = await client.query(`
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name, ordinal_position
  `);
  const relations = groupRelations(result.rows);
  const product = [...relations.values()]
    .filter((relation) => relation.table.toLocaleLowerCase("pt-BR") === "produto")
    .sort((left, right) => relationPriority(left) - relationPriority(right))[0];

  if (!product) throw new Error("Tabela produto nao encontrada no PostgreSQL do Uniplus.");

  const id = pickColumn(product, ["id"]);
  const name = pickColumn(product, ["nome", "descricao"]);
  const code = pickColumn(product, ["codigo", "codigoproduto", "referencia"]);
  const salePrice = pickColumn(product, ["preco", "precovenda", "preco_venda", "valorvenda"]);
  const inactive = pickColumn(product, ["inativo", "desativado"]);
  if (!id || !name || !salePrice) {
    throw new Error("A tabela produto nao possui id, nome e preco de venda reconheciveis.");
  }

  const directStock = pickColumn(product, STOCK_COLUMNS);
  if (directStock) {
    return {
      product: { ...product, id, name, code, salePrice, inactive },
      stock: { direct: true, quantity: directStock },
    };
  }

  const stockRelation = [...relations.values()]
    .filter((relation) => relation !== product)
    .map((relation) => ({
      relation,
      productId: pickColumn(relation, PRODUCT_ID_COLUMNS),
      quantity: pickColumn(relation, STOCK_COLUMNS),
      reserved: pickColumn(relation, RESERVED_COLUMNS),
    }))
    .filter((candidate) => candidate.productId && candidate.quantity)
    .filter((candidate) => !/(mov|movimento|historico|log|auditoria)/iu.test(candidate.relation.table))
    .sort((left, right) => stockRelationPriority(left.relation) - stockRelationPriority(right.relation))[0];

  if (!stockRelation?.productId || !stockRelation.quantity) {
    throw new Error(
      "Fonte de estoque nao encontrada. Informe ao suporte o nome da tabela e das colunas de saldo do Uniplus.",
    );
  }

  return {
    product: { ...product, id, name, code, salePrice, inactive },
    stock: {
      direct: false,
      schema: stockRelation.relation.schema,
      table: stockRelation.relation.table,
      productId: stockRelation.productId,
      quantity: stockRelation.quantity,
      reserved: stockRelation.reserved,
    },
  };
}

function buildCatalogQuery(schema) {
  const product = schema.product;
  const stock = schema.stock;
  const productTable = `${identifier(product.schema)}.${identifier(product.table)}`;
  const codeExpression = product.code
    ? `nullif(btrim(p.${identifier(product.code)}::text), '')`
    : "null";
  const inactiveExpression = product.inactive
    ? `coalesce(p.${identifier(product.inactive)}, false)::boolean`
    : "false";

  let stockExpression;
  let stockJoin = "";
  if (stock.direct) {
    stockExpression = `p.${identifier(stock.quantity)}::numeric`;
  } else {
    const stockTable = `${identifier(stock.schema)}.${identifier(stock.table)}`;
    stockExpression = "s.estoque";
    stockJoin = `
      left join (
        select
          ${identifier(stock.productId)} as produto_id,
          sum(coalesce(${identifier(stock.quantity)}::numeric, 0)) as estoque
        from ${stockTable}
        group by ${identifier(stock.productId)}
      ) s on s.produto_id = p.${identifier(product.id)}`;
  }

  return `
    select
      p.${identifier(product.id)}::bigint as uniplus_id,
      ${codeExpression} as codigo,
      btrim(p.${identifier(product.name)}::text) as nome,
      ${stockExpression} as estoque,
      p.${identifier(product.salePrice)}::numeric as preco_venda,
      ${inactiveExpression} as inativo
    from ${productTable} p
    ${stockJoin}
    where p.${identifier(product.id)} is not null
      and nullif(btrim(p.${identifier(product.name)}::text), '') is not null
    order by p.${identifier(product.name)} asc
  `;
}

function mapCatalogProduct(row, syncedAt) {
  return {
    uniplus_id: Number(row.uniplus_id),
    codigo: cleanText(row.codigo),
    nome: cleanText(row.nome) || `Produto ${row.uniplus_id}`,
    nome_busca: normalizeSearch(row.nome),
    estoque: nullableNumber(row.estoque),
    preco_venda: nullableNumber(row.preco_venda),
    inativo: Boolean(row.inativo),
    sincronizado_em: syncedAt,
    updated_at: syncedAt,
  };
}

async function upsertCatalog(products) {
  for (let offset = 0; offset < products.length; offset += WRITE_CHUNK_SIZE) {
    await supabaseRequest("crm_catalogo_produtos", {
      method: "POST",
      query: { on_conflict: "uniplus_id" },
      body: products.slice(offset, offset + WRITE_CHUNK_SIZE),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

async function removeStaleCatalogProducts(syncedAt) {
  await supabaseRequest("crm_catalogo_produtos", {
    method: "DELETE",
    query: { sincronizado_em: `lt.${syncedAt}` },
    prefer: "return=minimal",
  });
}

async function supabaseRequest(table, { method, query = {}, body, prefer }) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !secret) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorios para gravar o catalogo.");
  }

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: {
      apikey: secret,
      ...(secret.split(".").length === 3 ? { authorization: `Bearer ${secret}` } : {}),
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }
}

function groupRelations(rows) {
  const relations = new Map();
  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    const relation = relations.get(key) ?? {
      schema: row.table_schema,
      table: row.table_name,
      columns: new Map(),
    };
    relation.columns.set(row.column_name.toLocaleLowerCase("pt-BR"), row.column_name);
    relations.set(key, relation);
  }
  return relations;
}

function pickColumn(relation, candidates) {
  for (const candidate of candidates) {
    const column = relation.columns.get(candidate.toLocaleLowerCase("pt-BR"));
    if (column) return column;
  }
  return undefined;
}

function relationPriority(relation) {
  if (relation.schema === "public") return 0;
  return 1;
}

function stockRelationPriority(relation) {
  const name = relation.table.toLocaleLowerCase("pt-BR");
  const preferred = ["produtoestoque", "estoqueproduto", "produto_estoque", "estoque_produto", "estoque"];
  const exact = preferred.indexOf(name);
  if (exact >= 0) return exact;
  if (name.includes("estoque")) return 20;
  if (name.includes("saldo")) return 30;
  return 100;
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  return ["1", "true", "yes", "sim"].includes(String(value ?? "").trim().toLocaleLowerCase("pt-BR"));
}

function loadEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
