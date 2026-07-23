import { createHash } from "node:crypto";

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
    sanitizeDate(row.data_venda_final) ??
    sanitizeDate(row.data_venda) ??
    sanitizeDate(row.venda_data_inclusao) ??
    sanitizeDate(row.venda_data_alteracao)
  );
}

export function transformRows(rows, options = {}) {
  const referenceDate = options.referenceDate ?? new Date().toISOString().slice(0, 10);
  const sourceName = options.sourceName ?? "postgres-uniplus";
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
    const itemSaleId = integer(row.item_uniplus_venda_id);
    const productId = integer(row.uniplus_produto_id);
    const clientId = integer(row.uniplus_cliente_id);
    const sellerId = integer(row.uniplus_vendedor_id);
    const operatorId = integer(row.operador_usuario_id);
    const soldAtValue = resolveSaleDate(row);

    if (!saleId || !itemId || !productId || !clientId || !soldAtValue) {
      invalidRows.push({
        line: index + 2,
        reason: "identificador_ou_data_invalida",
      });
      continue;
    }

    if (itemSaleId && itemSaleId !== saleId) {
      invalidRows.push({
        line: index + 2,
        reason: "item_vinculado_a_outra_venda",
        saleId,
        itemSaleId,
        itemId,
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
        document: text(row.cliente_cpf_cnpj) || text(row.cpf_cnpj_cliente_venda) || undefined,
        phone: text(row.cliente_telefone) || undefined,
        mobile: text(row.cliente_celular) || undefined,
        whatsapp: text(row.cliente_celular) || text(row.cliente_whatsapp) || undefined,
        email: text(row.cliente_email) || undefined,
        address: text(row.cliente_endereco) || undefined,
        neighborhood: text(row.cliente_bairro) || undefined,
        cityId: integer(row.cliente_id_cidade),
        cityName: cityName(integer(row.cliente_id_cidade)),
        stateId: integer(row.cliente_id_estado),
        zipCode: text(row.cliente_cep) || undefined,
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
      sellers.set(sellerId, {
        id: sellerId,
        name: text(row.vendedor_nome) || `Vendedor ${sellerId}`,
        email: text(row.vendedor_email) || undefined,
        mobile: text(row.vendedor_celular) || undefined,
        whatsapp: text(row.vendedor_whatsapp) || undefined,
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
        operatorId,
        operatorName: text(row.operador_usuario_nome) || undefined,
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
      estimatedValue: decimal(row.item_valor_estimado),
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
      id: `uniplus-product-${product.id}`,
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
      source: sourceName,
      generatedAt: new Date().toISOString(),
      referenceDate,
      anonymized: false,
      privacy:
        "Dados preservados conforme resultado SQL recebido; proteger em ambiente de producao.",
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

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return !normalized || normalized.toUpperCase() === "NULL" ? null : normalized;
}

function text(value) {
  return fixEncoding(nullable(value) ?? "");
}

function fixEncoding(value) {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    if (!/[\u00c3\u00c2]|[\u0080-\u009f]/u.test(current)) break;
    const decoded = Buffer.from(current, "latin1").toString("utf8");
    if (decoded === current || decoded.includes("\uFFFD")) break;
    current = decoded;
  }
  return current.replace(/\u00a0/gu, " ");
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

function cityName(id) {
  if (id === 2698) return "Manhua\u00e7u";
  return id ? `Cidade ${id}` : undefined;
}

function saleStatus(value) {
  return {
    "1": "NAO_FATURADA",
    "2": "FATURADA",
  }[String(value ?? "")] ?? `STATUS_${text(value) || "NAO_INFORMADO"}`;
}

function inferDepartment(name, sourceDepartment) {
  const upper = normalizeSearch(name);
  if (/(RACAO|SACHE|AREIA HIGI|PETISCO|CAES|GATOS|COLEIRA)/u.test(upper)) {
    return "PET";
  }
  if (/(SEMENTE|ADUBO|FERTIL|HERBIC|INSETIC|FUNGIC|PULVER)/u.test(upper)) {
    return "AGRO";
  }
  if (/(ML|MG|VERM|INJET|VACINA|ANTIBI|COLIRIO|VET)/u.test(upper)) {
    return "VETERIN\u00c1RIA";
  }
  return text(sourceDepartment) === "1" ? "PET" : "AGRO E VETERIN\u00c1RIA";
}

function inferRepurchaseDays(name, department) {
  const upper = normalizeSearch(name);
  if (/(SACHE|PETISCO)/u.test(upper)) return 20;
  if (/(RACAO|AREIA HIGI)/u.test(upper)) return 30;
  if (/(VERM|ANTIPULG|CARRAP|VACINA)/u.test(upper)) return 90;
  if (department === "VETERIN\u00c1RIA") return 90;
  if (department === "AGRO") return 60;
  return 45;
}

function normalizeSearch(value) {
  return fixEncoding(String(value ?? ""))
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR");
}
