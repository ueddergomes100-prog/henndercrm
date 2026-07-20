import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import pg from "pg";
import { transformRows } from "./uniplus-row-transformer.mjs";

const DEFAULT_SQL_PATH = "docs/sql/uniplus_exportacao_crm_corrigida.sql";
const DEFAULT_LIMIT = 5000;
const DEFAULT_SYNC_LOOKBACK_MINUTES = 15;
const DEFAULT_SYNC_START_DATE = "2026-05-01";
const UNIPLUS_TIME_ZONE = "America/Sao_Paulo";
const SYNC_ORIGIN = "uniplus";
const RESOLVED_SALE_DATE_SQL = `COALESCE(
    CASE
      WHEN d.data BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
      THEN d.data
    END,
    CASE
      WHEN d.datainclusao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
      THEN d.datainclusao
    END,
    CASE
      WHEN d.dataalteracao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
      THEN d.dataalteracao
    END
  )`;

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const dryRun = !options.apply;
  const limit = positiveInteger(options.limit) ?? positiveInteger(process.env.UNIPLUS_SYNC_BATCH_SIZE) ?? DEFAULT_LIMIT;
  const since = await resolveSince(options.since);
  const dateWindow = since ? undefined : resolveDateWindow(options);
  const minimumSaleDate = since ? resolveMinimumSaleDate() : undefined;
  const startedAt = new Date().toISOString();

  const databaseUrl = process.env.UNIPLUS_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("UNIPLUS_DATABASE_URL nao configurado. Preencha .env.local antes de rodar o sync.");
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: parseBoolean(process.env.UNIPLUS_SSL) ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  let target;
  let syncId;
  try {
    const sql = await buildExtractionSql(options.sqlPath ?? DEFAULT_SQL_PATH, {
      dateWindow,
      since,
      minimumSaleDate,
      limit,
    });
    const queryStartedAt = Date.now();
    const result = await client.query(sql.text, sql.values);
    const queryDurationMs = Date.now() - queryStartedAt;
    const transformed = transformRows(normalizeRows(result.rows), {
      referenceDate: options.referenceDate ?? new Date().toISOString().slice(0, 10),
      sourceName: "postgres-uniplus",
    });
    const selected = selectValidRecords(transformed);
    target = dryRun ? new DryRunTarget() : new SupabaseTarget();
    syncId = await target.beginSync(SYNC_ORIGIN);

    await target.upsertClients(selected.clients);
    await target.upsertProducts(selected.products);
    await target.upsertSellers(selected.sellers);
    await target.upsertSales(selected.sales, selected.items);
    await target.saveIgnoredSales(selected.ignoredSales);

    const summary = {
      dryRun,
      syncId,
      startedAt,
      finishedAt: new Date().toISOString(),
      queryDurationMs,
      since: since ?? null,
      minimumSaleDate: minimumSaleDate ?? null,
      dateWindow: dateWindow ?? null,
      limit,
      rowsRead: result.rowCount,
      transformed: transformed.metadata,
      imported: {
        clients: selected.clients.length,
        sellers: selected.sellers.length,
        products: selected.products.length,
        sales: selected.sales.length,
        items: selected.items.length,
      },
      ignoredSales: selected.ignoredSales.length,
      ignoredReasons: countBy(selected.ignoredSales.map((sale) => sale.reason)),
      digest: digestRows(result.rows),
    };

    await target.finishSync(syncId, {
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      totalRead: transformed.sales.length,
      totalImported: selected.sales.length,
      totalIgnored: selected.ignoredSales.length,
      ignoredSales: selected.ignoredSales,
    });

    await maybeWriteOutput(options.output, summary);
    await writeLog(summary);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    if (target && syncId) {
      await target.failSync(syncId, {
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    await client.end();
  }
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--since") options.since = args[++index];
    else if (arg === "--date") options.date = args[++index];
    else if (arg === "--from") options.from = args[++index];
    else if (arg === "--to") options.to = args[++index];
    else if (arg === "--limit") options.limit = args[++index];
    else if (arg === "--sql") options.sqlPath = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--reference-date") options.referenceDate = args[++index];
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return options;
}

function printHelp() {
  process.stdout.write(`Hennder Sync - Uniplus -> Supabase

Uso:
  node scripts/hennder-sync.mjs --dry-run
  node scripts/hennder-sync.mjs --apply
  node scripts/hennder-sync.mjs --date 2026-07-10 --dry-run
  node scripts/hennder-sync.mjs --from 2026-05-10 --to 2026-07-11 --dry-run
  node scripts/hennder-sync.mjs --since auto --limit 5000 --dry-run
  node scripts/hennder-sync.mjs --since 2026-07-01T00:00:00-03:00 --apply

Opcoes:
  --dry-run              Le, transforma e audita sem gravar no Supabase. Padrao.
  --apply                Grava no Supabase usando SUPABASE_SECRET_KEY.
  --date <YYYY-MM-DD>    Sincroniza vendas de um dia. Padrao: hoje.
  --from <YYYY-MM-DD>    Inicio da janela de vendas por d.data, inclusivo.
  --to <YYYY-MM-DD>      Fim da janela de vendas por d.data, exclusivo.
  --since <valor|auto>   Filtro incremental por dataalteracao/datainclusao/data; ignora --date/--from/--to.
  --limit <numero>       Limite de linhas lidas. Padrao ${DEFAULT_LIMIT}.
  --sql <arquivo>        SQL de extracao. Padrao ${DEFAULT_SQL_PATH}.
  --output <arquivo>     Salva resumo JSON.
  --reference-date <dia> Data de referencia para regras demo, YYYY-MM-DD.
`);
}

async function buildExtractionSql(sqlPath, { dateWindow, since, minimumSaleDate, limit }) {
  let sql = await readFile(resolve(sqlPath), "utf8");
  const values = [];
  sql = sql.replace(/;\s*$/u, "").replace(/\s+LIMIT\s+\d+\s*$/iu, "");

  if (since) {
    values.push(since, UNIPLUS_TIME_ZONE);
    const incrementalConditions = [
      `  AND (
    (d.dataalteracao AT TIME ZONE $2) >= $1::timestamptz
    OR (d.datainclusao AT TIME ZONE $2) >= $1::timestamptz
    OR (
      (d.dataalteracao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day') IS NOT TRUE
      AND (d.datainclusao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day') IS NOT TRUE
      AND ${RESOLVED_SALE_DATE_SQL} >= ($1::timestamptz AT TIME ZONE $2)::date
    )
  )`,
    ];
    if (minimumSaleDate) {
      values.push(minimumSaleDate);
      incrementalConditions.push(`  AND ${RESOLVED_SALE_DATE_SQL} >= $${values.length}`);
    }
    sql = sql.replace(
      /\nORDER BY/iu,
      `\n${incrementalConditions.join("\n")}\n\nORDER BY`,
    );
  } else if (dateWindow) {
    values.push(dateWindow.from, dateWindow.to);
    sql = sql.replace(
      /\nORDER BY/iu,
      `\n  AND ${RESOLVED_SALE_DATE_SQL} >= $${values.length - 1}\n  AND ${RESOLVED_SALE_DATE_SQL} < $${values.length}\n\nORDER BY`,
    );
  }

  return {
    text: `${sql}\nLIMIT ${Math.max(1, Math.min(limit, 100000))};`,
    values,
  };
}

function resolveDateWindow(options) {
  const from = options.date ?? options.from ?? todayLocalDate();
  const to = options.date ? addDays(from, 1) : options.to ?? addDays(from, 1);
  assertDateOnly(from, "--date/--from");
  assertDateOnly(to, "--to");
  if (to <= from) throw new Error("--to precisa ser maior que --from.");
  return { from, to };
}

function resolveMinimumSaleDate() {
  const value = process.env.UNIPLUS_SYNC_START_DATE?.trim() || DEFAULT_SYNC_START_DATE;
  assertDateOnly(value, "UNIPLUS_SYNC_START_DATE");
  return value;
}

function todayLocalDate() {
  const now = new Date();
  return formatDateOnly(now);
}

function addDays(dateOnly, days) {
  assertDateOnly(dateOnly, "data");
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return formatDateOnly(date);
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assertDateOnly(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${label} deve usar o formato YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (formatDateOnly(date) !== value) {
    throw new Error(`${label} deve ser uma data valida.`);
  }
}

function todayWindow() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

async function resolveSince(value) {
  if (!value) return undefined;
  if (value !== "auto") return value;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !getSupabaseSecretKey()) {
    return undefined;
  }

  const target = new SupabaseTarget();
  const lastSuccessfulSync = await target.getLastSuccessfulSync();
  if (!lastSuccessfulSync) return undefined;

  const lookbackMinutes =
    positiveInteger(process.env.UNIPLUS_SYNC_LOOKBACK_MINUTES) ??
    DEFAULT_SYNC_LOOKBACK_MINUTES;
  return subtractMinutes(lastSuccessfulSync, lookbackMinutes);
}

function normalizeRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
    ),
  );
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

function selectValidRecords(data) {
  const clientMap = new Map(data.clients.map((client) => [client.id, client]));
  const productMap = new Map(data.products.map((product) => [product.id, product]));
  const itemsBySale = new Map();
  for (const item of data.items) {
    const current = itemsBySale.get(item.saleId) ?? [];
    current.push(item);
    itemsBySale.set(item.saleId, current);
  }

  const ignoredSales = [];
  const sales = [];
  for (const sale of data.sales) {
    const reason = getIgnoredReason(sale, itemsBySale.get(sale.id) ?? [], clientMap, productMap);
    if (reason) ignoredSales.push({ saleId: sale.id, reason, data: sale });
    else sales.push(sale);
  }

  const saleIds = new Set(sales.map((sale) => sale.id));
  const items = data.items.filter((item) => saleIds.has(item.saleId));
  const clientIds = new Set(sales.map((sale) => sale.clientId).filter(Boolean));
  const productIds = new Set(items.map((item) => item.productId).filter(Boolean));
  const sellerIds = new Set(sales.map((sale) => sale.sellerId).filter(Boolean));

  return {
    clients: data.clients.filter((client) => clientIds.has(client.id)),
    products: data.products.filter((product) => productIds.has(product.id)),
    sellers: data.sellers.filter((seller) => sellerIds.has(seller.id)),
    sales,
    items,
    ignoredSales,
  };
}

function getIgnoredReason(sale, items, clients, products) {
  if (!sale.clientId || !sale.clientName?.trim()) return "cliente_nao_identificado";
  if (sale.cancelledAt || sale.status.toLocaleUpperCase("pt-BR").includes("CANCEL")) return "venda_cancelada";
  if (!isBilledSale(sale.status)) return "venda_nao_faturada";
  const client = clients.get(sale.clientId);
  if (!client) return "dados_incompletos";
  if (client.inactive) return "cliente_inativo";
  if (items.length === 0) return "dados_incompletos";
  if (items.some((item) => !item.productId || !item.productName?.trim() || !products.has(item.productId))) {
    return "item_sem_produto";
  }
  return undefined;
}

function isBilledSale(status) {
  const normalized = String(status ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR");
  return normalized === "FATURADA" || normalized === "FINALIZADA" || normalized === "STATUS_2";
}

class DryRunTarget {
  async beginSync() {
    return `dry-run-${new Date().toISOString()}`;
  }

  async upsertClients() {}
  async upsertProducts() {}
  async upsertSellers() {}
  async upsertSales() {}
  async saveIgnoredSales() {}
  async finishSync() {}
  async failSync() {}
}

class SupabaseTarget {
  constructor(
    baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey = getSupabaseSecretKey(),
  ) {
    if (!baseUrl || !secretKey) {
      throw new Error("Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
    }
    this.baseUrl = baseUrl;
    this.secretKey = secretKey;
  }

  async getLastSuccessfulSync() {
    const rows = await this.request("crm_sincronizacoes", {
      query: {
        select: "fim",
        origem: `eq.${SYNC_ORIGIN}`,
        status: "eq.concluida",
        order: "fim.desc",
        limit: "1",
      },
    });
    return rows[0]?.fim;
  }

  async beginSync(origin) {
    const today = todayWindow();
    const existing = await this.request("crm_sincronizacoes", {
      query: {
        select: "id",
        origem: `eq.${origin}`,
        inicio: `gte.${today.from}`,
        order: "inicio.desc",
        limit: "1",
      },
    });
    if (existing[0]?.id) {
      await this.update("crm_sincronizacoes", { id: existing[0].id }, {
        status: "iniciada",
        inicio: new Date().toISOString(),
        fim: null,
        erro: null,
      });
      return existing[0].id;
    }

    const [run] = await this.insert("crm_sincronizacoes", [{
      origem: origin,
      status: "iniciada",
      inicio: new Date().toISOString(),
    }]);
    return run.id;
  }

  async upsertClients(clients) {
    if (clients.length === 0) return;
    await this.upsert("crm_clientes", clients.map(mapClient), "uniplus_id");
  }

  async upsertProducts(products) {
    if (products.length === 0) return;
    await this.upsert("crm_produtos", uniqueProductsByCode(products).map(mapProduct), "uniplus_id");
  }

  async upsertSellers(sellers) {
    if (sellers.length === 0) return;
    await this.upsert("crm_vendedores", sellers.map(mapSeller), "uniplus_id");
  }

  async upsertSales(sales, items) {
    if (sales.length === 0) return;
    const [clients, sellers, products] = await Promise.all([
      this.selectAll("crm_clientes", { select: "id,uniplus_id" }),
      this.selectAll("crm_vendedores", { select: "id,uniplus_id" }),
      this.selectAll("crm_produtos", { select: "id,uniplus_id,codigo,preco" }),
    ]);
    const clientIds = new Map(clients.map((row) => [Number(row.uniplus_id), row.id]));
    const sellerIds = new Map(sellers.map((row) => [Number(row.uniplus_id), row.id]));
    const productIds = new Map(products.map((row) => [Number(row.uniplus_id), row.id]));
    const productIdsByCode = new Map(
      products.flatMap((row) => {
        const code = normalizeProductCode(row.codigo);
        return code ? [[code, row.id]] : [];
      }),
    );

    await this.upsert(
      "crm_vendas",
      sales.map((sale) => completeRow({
        uniplus_id: sale.id,
        cliente_id: clientIds.get(sale.clientId),
        vendedor_id: sale.sellerId ? sellerIds.get(sale.sellerId) ?? null : null,
        data_venda: sale.soldAt,
        data_inclusao: sale.includedAt,
        data_alteracao: sale.changedAt,
        valor_total: sale.totalValue,
        valor_desconto: sale.discountValue,
        status: sale.status,
        aprovado: sale.approved,
        cancelada: Boolean(sale.cancelledAt),
        data_cancelamento: sale.cancelledAt ?? null,
      })),
      "uniplus_id",
    );

    const storedSales = await this.selectAll("crm_vendas", { select: "id,uniplus_id" });
    const saleIds = new Map(storedSales.map((row) => [Number(row.uniplus_id), row.id]));

    await this.removeStaleSaleItems(sales, items, saleIds);

    await this.upsert(
      "crm_itens_venda",
      items.map((item) => completeRow({
        uniplus_id: item.id,
        venda_id: saleIds.get(item.saleId),
        produto_id: resolveProductRowId(item, productIds, productIdsByCode),
        codigo_produto: item.productCode ?? null,
        nome_produto: item.productName ?? "",
        quantidade: item.quantity,
        valor_estimado: item.estimatedValue ?? 0,
      })),
      "uniplus_id",
    );
  }

  async removeStaleSaleItems(sales, items, saleIds) {
    const importedSaleIds = new Set(
      sales.flatMap((sale) => {
        const id = saleIds.get(sale.id);
        return id ? [id] : [];
      }),
    );
    if (importedSaleIds.size === 0) return;

    const [storedItems, alerts] = await Promise.all([
      this.selectAll("crm_itens_venda", { select: "id,uniplus_id,venda_id" }),
      this.selectAll("crm_alertas_recompra", { select: "item_venda_id" }),
    ]);
    const expectedSaleByItemId = new Map(
      items.map((item) => [item.id, saleIds.get(item.saleId)]),
    );
    const protectedItemIds = new Set(
      alerts.flatMap((alert) => alert.item_venda_id ? [alert.item_venda_id] : []),
    );
    const staleItems = storedItems.filter((item) =>
      importedSaleIds.has(item.venda_id) &&
      expectedSaleByItemId.get(Number(item.uniplus_id)) !== item.venda_id &&
      !protectedItemIds.has(item.id),
    );

    for (const item of staleItems) {
      await this.delete("crm_itens_venda", { id: item.id });
    }
  }

  async saveIgnoredSales(ignoredSales) {
    if (ignoredSales.length === 0) return;
    const existing = await this.selectAll("crm_vendas_ignoradas", { select: "uniplus_venda_id" });
    const existingIds = new Set(existing.flatMap((row) => row.uniplus_venda_id === null ? [] : [Number(row.uniplus_venda_id)]));
    const rows = ignoredSales.filter((sale) => !existingIds.has(sale.saleId));
    if (rows.length === 0) return;
    await this.insert(
      "crm_vendas_ignoradas",
      rows.map((sale) => ({
        uniplus_venda_id: sale.saleId,
        motivo: sale.reason,
        dados: sale.data,
      })),
      false,
    );
  }

  async finishSync(syncId, result) {
    await this.update("crm_sincronizacoes", { id: syncId }, {
      status: "concluida",
      fim: result.finishedAt,
      total_lidos: result.totalRead,
      total_importados: result.totalImported,
      total_ignorados: result.totalIgnored,
    });
  }

  async failSync(syncId, result) {
    await this.update("crm_sincronizacoes", { id: syncId }, {
      status: "erro",
      fim: result.finishedAt,
      erro: result.error,
    });
  }

  async select(table, query = {}) {
    return this.request(table, { query });
  }

  async selectAll(table, query = {}) {
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.select(table, { ...query, limit: pageSize, offset });
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async insert(table, rows, returnRepresentation = true) {
    return this.request(table, {
      method: "POST",
      body: rows,
      prefer: returnRepresentation ? "return=representation" : "return=minimal",
    });
  }

  async upsert(table, rows, conflictColumn) {
    return this.request(table, {
      method: "POST",
      query: { on_conflict: conflictColumn },
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    });
  }

  async update(table, filters, values) {
    return this.request(table, {
      method: "PATCH",
      query: Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, `eq.${value}`])),
      body: values,
      prefer: "return=representation",
    });
  }

  async delete(table, filters) {
    return this.request(table, {
      method: "DELETE",
      query: Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, `eq.${value}`]),
      ),
      prefer: "return=minimal",
    });
  }

  async request(table, options = {}) {
    const url = new URL(`/rest/v1/${table}`, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: this.secretKey,
        ...(isJwt(this.secretKey) ? { authorization: `Bearer ${this.secretKey}` } : {}),
        "content-type": "application/json",
        ...(options.prefer ? { prefer: options.prefer } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
    return text ? JSON.parse(text) : [];
  }
}

function isJwt(value) {
  return value.split(".").length === 3;
}

function mapClient(client) {
  const quality = calculateRegistrationQuality(client);
  return {
    uniplus_id: client.id,
    codigo: client.code ?? null,
    nome: client.name,
    razao_social: client.legalName ?? null,
    cpf_cnpj: client.document ?? null,
    telefone: client.phone ?? null,
    celular: client.mobile ?? null,
    whatsapp: client.whatsapp ?? null,
    email: client.email ?? null,
    endereco: client.address ?? null,
    bairro: client.neighborhood ?? null,
    cidade_id: client.cityId ?? null,
    estado_id: client.stateId ?? null,
    cep: client.zipCode ?? null,
    data_cadastro: client.registeredAt ?? null,
    data_ultima_compra: client.lastPurchaseAt ?? null,
    inativo: client.inactive,
    categoria_cliente_id: client.categoryId ?? null,
    classificacao_cliente_id: client.classificationId ?? null,
    ciclo_compras: client.purchaseCycleDays ?? null,
    qualidade_cadastro_score: quality.score,
    qualidade_cadastro_status: quality.status,
  };
}

function mapProduct(product) {
  return {
    uniplus_id: product.id,
    codigo: product.code ?? null,
    nome: product.name,
    tipo: product.type ?? null,
    departamento: product.department ?? null,
    fabricante_id: product.manufacturerId ?? null,
    fornecedor: product.supplier ?? null,
    preco: product.price,
    data_ultima_venda: product.lastSaleAt ?? null,
    data_ultima_compra: product.lastPurchaseAt ?? null,
    tipo_produto: product.productType ?? null,
    utiliza_crm: product.usesCrm,
    recompra_ativa: product.usesCrm,
  };
}

function uniqueProductsByCode(products) {
  const unique = new Map();
  for (const product of products) {
    const key = normalizeProductCode(product.code) || `id:${product.id}`;
    if (!unique.has(key)) {
      unique.set(key, product);
      continue;
    }

    const current = unique.get(key);
    unique.set(key, {
      ...current,
      name: current.name || product.name,
      department: current.department || product.department,
      price: current.price || product.price,
      usesCrm: current.usesCrm || product.usesCrm,
      lastSaleAt: maxDate(current.lastSaleAt, product.lastSaleAt),
      lastPurchaseAt: maxDate(current.lastPurchaseAt, product.lastPurchaseAt),
    });
  }
  return [...unique.values()];
}

function resolveProductRowId(item, productIds, productIdsByCode) {
  if (item.productCode) {
    const byCode = productIdsByCode.get(normalizeProductCode(item.productCode));
    if (byCode) return byCode;
  }
  return item.productId ? productIds.get(item.productId) ?? null : null;
}

function normalizeProductCode(code) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return normalized || null;
}

function maxDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return right > left ? right : left;
}

function completeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === undefined ? null : value]),
  );
}

function mapSeller(seller) {
  return {
    uniplus_id: seller.id,
    nome: seller.name,
    email: seller.email ?? null,
    celular: seller.mobile ?? null,
    whatsapp: seller.whatsapp ?? null,
    supervisor: seller.supervisor,
    inativo: seller.inactive,
    perfil_id: seller.profileId ?? null,
  };
}

function calculateRegistrationQuality(client) {
  let score = 0;
  if (client.name?.trim()) score += 15;
  if (client.document?.trim()) score += 15;
  if (client.phone?.trim() || client.mobile?.trim()) score += 20;
  if (client.whatsapp?.trim()) score += 20;
  if (client.email?.trim()) score += 10;
  if (client.cityId) score += 10;
  if (client.neighborhood?.trim()) score += 5;
  if (client.address?.trim()) score += 5;
  return { score, status: classifyRegistrationQuality(score) };
}

function classifyRegistrationQuality(score) {
  if (score >= 90) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 40) return "regular";
  return "ruim";
}

function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function maybeWriteOutput(output, summary) {
  if (!output) return;
  const file = resolve(output);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function writeLog(summary) {
  const directory = process.env.HENNDER_SYNC_LOG_DIR;
  if (!directory) return;
  await mkdir(resolve(directory), { recursive: true });
  const file = resolve(directory, `hennder-sync-${new Date().toISOString().slice(0, 10)}.log`);
  await appendFile(file, `${JSON.stringify(summary)}\n`, "utf8");
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function digestRows(rows) {
  return createHash("sha256")
    .update(JSON.stringify(rows.map((row) => [row.uniplus_venda_id, row.uniplus_item_id])))
    .digest("hex");
}

function positiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function subtractMinutes(value, minutes) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCMinutes(date.getUTCMinutes() - minutes);
  return date.toISOString();
}

function parseBoolean(value) {
  return ["1", "true", "t", "sim", "s", "yes", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function loadEnvFile(path) {
  try {
    const text = readFileSync(resolve(path), "utf8");
    for (const line of text.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/u);
      if (!match || process.env[match[1]]?.trim()) continue;
      process.env[match[1]] = unquoteEnvValue(match[2]);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
