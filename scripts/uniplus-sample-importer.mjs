import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...values] = rows.filter((entry) => entry.some(Boolean));
  return values.map((entry) =>
    Object.fromEntries(headers.map((header, index) => [header, entry[index] ?? ""])),
  );
}

export function sanitizeDate(value) {
  const normalized = nullable(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return normalized;
}

export function resolveSaleDate(row) {
  return (
    sanitizeDate(row.data_venda) ??
    sanitizeDate(row.venda_data_inclusao) ??
    sanitizeDate(row.venda_data_alteracao)
  );
}

export function transformRows(rows, options = {}) {
  const referenceDate = options.referenceDate ?? new Date().toISOString().slice(0, 10);
  const clients = new Map();
  const sellers = new Map();
  const products = new Map();
  const sales = new Map();
  const items = new Map();
  const invalidRows = [];
  const saleItemIds = new Map();

  for (const [index, row] of rows.entries()) {
    const saleId = integer(row.uniplus_venda_id);
    const itemId = integer(row.uniplus_item_id);
    const productId = integer(row.uniplus_produto_id);
    const clientId = integer(row.uniplus_cliente_id);
    const sellerId = integer(row.uniplus_vendedor_id);
    const soldAtValue = resolveSaleDate(row);

    if (!saleId || !itemId || !productId || !clientId || !soldAtValue) {
      invalidRows.push({
        line: index + 2,
        reason: "identificador_ou_data_invalida",
      });
      continue;
    }

    const soldAt = soldAtValue.slice(0, 10);
    const includedAt =
      sanitizeDate(row.venda_data_inclusao) ??
      sanitizeDate(row.venda_data_alteracao) ??
      `${soldAt}T12:00:00`;
    const changedAt =
      sanitizeDate(row.venda_data_alteracao) ??
      sanitizeDate(row.venda_data_inclusao) ??
      `${soldAt}T12:00:00`;
    const productName = text(row.produto_nome) || text(row.produto_nome_item) || `Produto ${productId}`;
    const productCode = text(row.produto_codigo) || text(row.produto_codigo_item) || String(productId);
    const department = inferDepartment(productName, row.produto_departamento);
    const cycleDays = inferRepurchaseDays(productName, department);

    if (!clients.has(clientId)) {
      const clientNumber = clients.size + 1;
      clients.set(clientId, {
        id: clientId,
        code: text(row.cliente_codigo) || `CLI-${String(clientNumber).padStart(4, "0")}`,
        name:
          text(row.cliente_nome_cadastro) ||
          text(row.nome_cliente_venda) ||
          `Cliente ${clientId}`,
        legalName: text(row.cliente_razao_social) || undefined,
        document: hasValue(row.cliente_cpf_cnpj) || hasValue(row.cpf_cnpj_cliente_venda)
          ? fakeDocument(clientId)
          : undefined,
        phone: hasValue(row.cliente_telefone) ? fakePhone(clientId, false) : undefined,
        mobile: hasValue(row.cliente_celular) ? fakePhone(clientId, true) : undefined,
        whatsapp: hasValue(row.cliente_whatsapp) ? fakePhone(clientId, true) : undefined,
        email: hasValue(row.cliente_email)
          ? `cliente${String(clientNumber).padStart(3, "0")}@demo.henndercrm.local`
          : undefined,
        address: hasValue(row.cliente_endereco) ? `Endereço Demonstrativo, ${100 + clientNumber}` : undefined,
        neighborhood: hasValue(row.cliente_bairro) ? `Bairro Demonstrativo ${clientNumber}` : undefined,
        cityId: integer(row.cliente_id_cidade),
        cityName: cityName(integer(row.cliente_id_cidade)),
        stateId: integer(row.cliente_id_estado),
        zipCode: hasValue(row.cliente_cep) ? fakeZip(clientId) : undefined,
        registeredAt: sanitizeDate(row.cliente_data_cadastro)?.slice(0, 10) ?? undefined,
        lastPurchaseAt: sanitizeDate(row.cliente_data_ultima_compra)?.slice(0, 10) ?? soldAt,
        inactive: booleanValue(row.cliente_inativo),
        categoryId: integer(row.cliente_categoria_id),
        categoryName: department === "PET" ? "Pet" : "Agro e Veterinária",
        classificationId: integer(row.cliente_classificacao_id),
        purchaseCycleDays: positiveInteger(row.cliente_ciclo_compras) ?? cycleDays,
      });
    } else {
      const client = clients.get(clientId);
      if (soldAt > (client.lastPurchaseAt ?? "")) client.lastPurchaseAt = soldAt;
      if (department === "PET") client.categoryName = "Pet";
      client.purchaseCycleDays = Math.min(client.purchaseCycleDays ?? cycleDays, cycleDays);
    }

    if (sellerId && !sellers.has(sellerId)) {
      const sellerNumber = sellers.size + 1;
      sellers.set(sellerId, {
        id: sellerId,
        name: text(row.vendedor_nome) || `Vendedor ${sellerId}`,
        email: hasValue(row.vendedor_email)
          ? `vendedor${String(sellerNumber).padStart(2, "0")}@demo.henndercrm.local`
          : undefined,
        mobile: hasValue(row.vendedor_celular) ? fakePhone(sellerId, true) : undefined,
        whatsapp: hasValue(row.vendedor_whatsapp) ? fakePhone(sellerId, true) : undefined,
        supervisor: booleanValue(row.vendedor_supervisor),
        inactive: booleanValue(row.vendedor_inativo),
        profileId: integer(row.vendedor_perfil_id),
      });
    }

    if (!products.has(productId)) {
      products.set(productId, {
        id: productId,
        code: productCode,
        name: productName,
        type: text(row.produto_tipo),
        department,
        manufacturerId: integer(row.produto_fabricante_id),
        price: decimal(row.produto_preco),
        lastSaleAt: sanitizeDate(row.produto_data_ultima_venda)?.slice(0, 10) ?? undefined,
        lastPurchaseAt: sanitizeDate(row.produto_data_ultima_compra)?.slice(0, 10) ?? undefined,
        productType: text(row.produto_tipo_produto),
        usesCrm: cycleDays > 0,
      });
    }

    if (!sales.has(saleId)) {
      sales.set(saleId, {
        id: saleId,
        soldAt,
        includedAt,
        changedAt,
        clientId,
        clientName: clients.get(clientId).name,
        clientDocument: clients.get(clientId).document,
        sellerId,
        totalValue: decimal(row.valor_venda),
        discountValue: decimal(row.valor_desconto),
        status: saleStatus(row.venda_status),
        approved: true,
      });
    }

    if (items.has(itemId)) {
      invalidRows.push({ line: index + 2, reason: "item_duplicado" });
      continue;
    }
    items.set(itemId, {
      id: itemId,
      saleId,
      productId,
      productCode,
      productName,
      quantity: decimal(row.item_quantidade),
      includedAt:
        sanitizeDate(row.item_data_inclusao) ??
        sanitizeDate(row.venda_data_inclusao) ??
        `${soldAt}T12:00:00`,
    });
    const ids = saleItemIds.get(saleId) ?? [];
    ids.push(itemId);
    saleItemIds.set(saleId, ids);
  }

  const repurchaseRules = [...products.values()]
    .filter((product) => product.usesCrm)
    .map((product) => ({
      id: `sample-product-${product.id}`,
      type: "produto",
      productId: product.id,
      days: inferRepurchaseDays(product.name, product.department),
      priority: 100,
      active: true,
      note: "Regra demonstrativa gerada a partir do tipo de produto.",
    }));

  const multiItemSales = [...saleItemIds.values()].filter((ids) => ids.length > 1).length;
  const maxItemsPerSale = Math.max(0, ...[...saleItemIds.values()].map((ids) => ids.length));

  return {
    metadata: {
      source: "uniplus_sample_result.csv",
      generatedAt: new Date().toISOString(),
      referenceDate,
      anonymized: false,
      privacy:
        "Nomes preservados por solicitação; documentos, contatos e endereços pseudonimizados.",
      rowsRead: rows.length,
      clients: clients.size,
      sellers: sellers.size,
      products: products.size,
      sales: sales.size,
      items: items.size,
      multiItemSales,
      maxItemsPerSale,
      invalidRows,
      digest: createHash("sha256")
        .update(JSON.stringify(rows.map((row) => [row.uniplus_venda_id, row.uniplus_item_id])))
        .digest("hex"),
    },
    clients: [...clients.values()],
    sellers: [...sellers.values()],
    products: [...products.values()],
    sales: [...sales.values()].sort((a, b) => a.id - b.id),
    items: [...items.values()].sort((a, b) => a.id - b.id),
    repurchaseRules,
  };
}

export async function importSample({
  input,
  output,
  referenceDate,
}) {
  const source = await readFile(input, "utf8");
  const result = transformRows(parseCsv(source.replace(/^\uFEFF/, "")), { referenceDate });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result.metadata;
}

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return !normalized || normalized.toUpperCase() === "NULL" ? null : normalized;
}

function text(value) {
  return nullable(value) ?? "";
}

function hasValue(value) {
  return nullable(value) !== null;
}

function integer(value) {
  const normalized = nullable(value);
  if (!normalized) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveInteger(value) {
  const parsed = integer(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function decimal(value) {
  const normalized = nullable(value);
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value) {
  return ["1", "true", "t", "sim", "s"].includes(String(value ?? "").trim().toLowerCase());
}

function fakeDocument(id) {
  const digits = String(100_000_000_00 + (id % 89_999_999_999)).padStart(11, "0");
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function fakePhone(id, mobile) {
  const suffix = String(10_000_000 + (id % 89_999_999)).padStart(8, "0");
  return mobile
    ? `(33) 9${suffix.slice(0, 4)}-${suffix.slice(4)}`
    : `(33) 3${suffix.slice(1, 4)}-${suffix.slice(4)}`;
}

function fakeZip(id) {
  return `369${String(id % 100).padStart(2, "0")}-${String(id % 1000).padStart(3, "0")}`;
}

function cityName(id) {
  if (id === 2698) return "Manhuaçu";
  return id ? `Cidade ${id}` : undefined;
}

function saleStatus(value) {
  return {
    "1": "EMITIDA",
    "2": "FINALIZADA",
  }[String(value ?? "")] ?? `STATUS_${text(value) || "NAO_INFORMADO"}`;
}

function inferDepartment(name, sourceDepartment) {
  const upper = name.toLocaleUpperCase("pt-BR");
  if (/(RAÇÃO|RACAO|SACHÊ|SACHE|AREIA HIGI|PETISCO|CÃES|CAES|GATOS|COLEIRA)/u.test(upper)) {
    return "PET";
  }
  if (/(SEMENTE|ADUBO|FERTIL|HERBIC|INSETIC|FUNGIC|PULVER)/u.test(upper)) {
    return "AGRO";
  }
  if (/(ML|MG|VERM|INJET|VACINA|ANTIBI|COLÍRIO|COLIRIO|VET)/u.test(upper)) {
    return "VETERINÁRIA";
  }
  return text(sourceDepartment) === "1" ? "PET" : "AGRO E VETERINÁRIA";
}

function inferRepurchaseDays(name, department) {
  const upper = name.toLocaleUpperCase("pt-BR");
  if (/(SACHÊ|SACHE|PETISCO)/u.test(upper)) return 20;
  if (/(RAÇÃO|RACAO|AREIA HIGI)/u.test(upper)) return 30;
  if (/(VERM|ANTIPULG|CARRAP|VACINA)/u.test(upper)) return 90;
  if (department === "VETERINÁRIA") return 90;
  if (department === "AGRO") return 60;
  return 45;
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const outputIndex = args.indexOf("--output");
  const dateIndex = args.indexOf("--reference-date");
  const input = resolve(inputIndex >= 0 ? args[inputIndex + 1] : "H:/uniplus_sample_result.csv");
  const output = resolve(
    outputIndex >= 0 ? args[outputIndex + 1] : "src/data/generated/uniplus-sample.json",
  );
  const referenceDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
  const metadata = await importSample({ input, output, referenceDate });
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
