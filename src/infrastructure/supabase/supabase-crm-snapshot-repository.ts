import "server-only";

import {
  addDays,
  calculatePotentialLost,
  calculatePreferredSeller,
  calculateRepurchaseScore,
  classifyCustomerActivity,
  daysBetween,
  resolveCustomerWhatsApp,
  roundCurrency,
} from "@/domain/crm/rules";
import type {
  CrmAgendaEvent,
  CrmCustomer,
  CrmDashboard,
  CrmOpportunity,
  CrmProduct,
  CrmRepurchaseAlert,
  CrmSale,
  CrmSaleItem,
  CrmSeller,
  CrmSnapshot,
  RepurchaseAlertOrigin,
  RepurchaseAlertStatus,
  RegistrationQualityStatus,
  UniplusSale,
  UniplusSeller,
} from "@/domain/crm/types";
import type { ICrmSnapshotRepository } from "@/infrastructure/crm-snapshot-repository";
import { SupabaseRestClient } from "./supabase-rest-client";

type ClientRow = {
  id: string;
  uniplus_id: number | null;
  codigo: string | null;
  nome: string;
  razao_social: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  celular: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade_id: number | null;
  estado_id: number | null;
  cep: string | null;
  data_cadastro: string | null;
  data_ultima_compra: string | null;
  inativo: boolean;
  ciclo_compras: number | null;
  qualidade_cadastro_score: number;
  qualidade_cadastro_status: RegistrationQualityStatus | null;
};
type SellerRow = {
  id: string;
  uniplus_id: number;
  nome: string;
  email: string | null;
  celular: string | null;
  whatsapp: string | null;
  supervisor: boolean;
  inativo: boolean;
};
type ProductRow = {
  id: string;
  uniplus_id: number;
  codigo: string | null;
  nome: string;
  tipo: string | null;
  departamento: string | null;
  fornecedor: string | null;
  preco: number | null;
  utiliza_crm: boolean;
  recompra_ativa: boolean;
  dias_recompra_padrao: number | null;
};
type SaleRow = {
  id: string;
  uniplus_id: number;
  cliente_id: string;
  vendedor_id: string | null;
  data_venda: string;
  updated_at: string;
  valor_total: number | null;
  valor_desconto: number | null;
  status: string | null;
  aprovado: boolean | null;
};
type SaleItemRow = {
  id: string;
  uniplus_id: number;
  venda_id: string;
  produto_id: string | null;
  codigo_produto: string | null;
  nome_produto: string;
  quantidade: number;
  valor_estimado: number | null;
};
type AlertRow = {
  id: string;
  cliente_id: string;
  produto_id: string | null;
  venda_id: string;
  item_venda_id: string;
  vendedor_responsavel_id: string | null;
  data_compra: string;
  data_prevista_recompra: string;
  dias_recompra: number;
  status: RepurchaseAlertStatus;
  prioridade: CrmRepurchaseAlert["priority"];
  origem: RepurchaseAlertOrigin;
  observacao: string | null;
};
type OpportunityRow = {
  id: string;
  cliente_id: string;
  produto_origem_id: string | null;
  produto_sugerido_nome: string;
  motivo: string | null;
  confianca: number | null;
  status: CrmOpportunity["status"];
  vendedor_responsavel_id: string | null;
};
type AgendaRow = {
  id: string;
  titulo: string;
  tipo: CrmAgendaEvent["type"];
  data_evento: string;
  hora_evento: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  concluido: boolean;
  observacao: string | null;
};

export class SupabaseCrmSnapshotRepository implements ICrmSnapshotRepository {
  constructor(private readonly client = new SupabaseRestClient()) {}

  async getDashboardSnapshot(): Promise<CrmSnapshot> {
    const referenceDate = new Date().toISOString().slice(0, 10);
    const [clientRows, sellerRows, productRows, saleRows, alertRows, agendaRows] =
      await Promise.all([
        this.client.select<ClientRow>("crm_clientes", {
          select:
            "id,uniplus_id,codigo,nome,razao_social,cpf_cnpj,telefone,celular,whatsapp,email,endereco,bairro,cidade_id,estado_id,cep,data_cadastro,data_ultima_compra,inativo,ciclo_compras,qualidade_cadastro_score,qualidade_cadastro_status",
          order: "nome.asc",
        }),
        this.client.select<SellerRow>("crm_vendedores", {
          select: "id,uniplus_id,nome,email,celular,whatsapp,supervisor,inativo",
          order: "nome.asc",
        }),
        this.client.select<ProductRow>("crm_produtos", {
          select:
            "id,uniplus_id,codigo,nome,tipo,departamento,fornecedor,preco,utiliza_crm,recompra_ativa,dias_recompra_padrao",
          order: "nome.asc",
        }),
        this.client.select<SaleRow>("crm_vendas", {
          select:
            "id,uniplus_id,cliente_id,vendedor_id,data_venda,updated_at,valor_total,valor_desconto,status,aprovado",
          order: "data_venda.desc",
        }),
        this.client.select<AlertRow>("crm_alertas_recompra", {
          select:
            "id,cliente_id,produto_id,venda_id,item_venda_id,vendedor_responsavel_id,data_compra,data_prevista_recompra,dias_recompra,status,prioridade,origem,observacao",
          order: "data_prevista_recompra.asc",
        }),
        this.client.select<AgendaRow>("crm_agenda_eventos", {
          select: "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id,concluido,observacao",
          order: "data_evento.asc,hora_evento.asc",
        }),
      ]);

    const sellers = mapSellers(sellerRows);
    const products = mapProducts(productRows);
    const sales = mapSales(saleRows);
    const saleClientIds = new Set(saleRows.map((sale) => sale.cliente_id));
    const syncedClientRows = clientRows.filter((client) => saleClientIds.has(client.id));
    const customers = mapCustomers(syncedClientRows, saleRows, sellerRows, referenceDate);
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const mappedAlerts = currentRepurchaseAlerts(alertRows, saleRows).flatMap((row) =>
      mapAlert(row, customersById, sellersById, productsById),
    );

    return {
      referenceDate,
      dashboard: buildDashboard(customers, mappedAlerts, referenceDate),
      customers,
      sellers: buildSellerMetrics(sellers, customers, mappedAlerts),
      products,
      sales,
      saleItems: [],
      alerts: mappedAlerts,
      opportunities: [],
      agenda: agendaRows
        .filter((row) => !row.cliente_id || saleClientIds.has(row.cliente_id))
        .map(mapAgenda),
    };
  }

  async getSnapshot(): Promise<CrmSnapshot> {
    const referenceDate = new Date().toISOString().slice(0, 10);
    const [clientRows, sellerRows, productRows, saleRows, itemRows, alertRows, opportunityRows, agendaRows] =
      await Promise.all([
        this.client.select<ClientRow>("crm_clientes", {
          select:
            "id,uniplus_id,codigo,nome,razao_social,cpf_cnpj,telefone,celular,whatsapp,email,endereco,bairro,cidade_id,estado_id,cep,data_cadastro,data_ultima_compra,inativo,ciclo_compras,qualidade_cadastro_score,qualidade_cadastro_status",
          order: "nome.asc",
        }),
        this.client.select<SellerRow>("crm_vendedores", {
          select: "id,uniplus_id,nome,email,celular,whatsapp,supervisor,inativo",
          order: "nome.asc",
        }),
        this.client.select<ProductRow>("crm_produtos", {
          select:
            "id,uniplus_id,codigo,nome,tipo,departamento,fornecedor,preco,utiliza_crm,recompra_ativa,dias_recompra_padrao",
          order: "nome.asc",
        }),
        this.client.select<SaleRow>("crm_vendas", {
          select:
            "id,uniplus_id,cliente_id,vendedor_id,data_venda,updated_at,valor_total,valor_desconto,status,aprovado",
          order: "data_venda.desc",
        }),
        this.client.select<SaleItemRow>("crm_itens_venda", {
          select:
            "id,uniplus_id,venda_id,produto_id,codigo_produto,nome_produto,quantidade,valor_estimado",
        }),
        this.client.select<AlertRow>("crm_alertas_recompra", {
          select:
            "id,cliente_id,produto_id,venda_id,item_venda_id,vendedor_responsavel_id,data_compra,data_prevista_recompra,dias_recompra,status,prioridade,origem,observacao",
          order: "data_prevista_recompra.asc",
        }),
        this.client.select<OpportunityRow>("crm_oportunidades", {
          select:
            "id,cliente_id,produto_origem_id,produto_sugerido_nome,motivo,confianca,status,vendedor_responsavel_id",
          order: "created_at.desc",
        }),
        this.client.select<AgendaRow>("crm_agenda_eventos", {
          select: "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id,concluido,observacao",
          order: "data_evento.asc,hora_evento.asc",
        }),
      ]);

    const sellers = mapSellers(sellerRows);
    const sales = mapSales(saleRows);
    const saleItems = mapSaleItems(itemRows);
    const products = mapProducts(productRows);
    const saleClientIds = new Set(saleRows.map((sale) => sale.cliente_id));
    const syncedClientRows = clientRows.filter((client) => saleClientIds.has(client.id));
    const customers = mapCustomers(syncedClientRows, saleRows, sellerRows, referenceDate);
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const operationalAlertRows = await this.ensureDerivedRepurchaseAlerts(
      saleRows,
      itemRows,
      productRows,
      referenceDate,
      alertRows,
    );
    const operationalOpportunityRows = opportunityRows.length
      ? opportunityRows
      : await this.ensureDerivedOpportunities(
          syncedClientRows,
          saleRows,
          itemRows,
          productRows,
          referenceDate,
        );
    const lonaOpportunityRows = operationalOpportunityRows.filter(isLonaOpportunityRow);
    const mappedAlerts = operationalAlertRows.flatMap((row) =>
      mapAlert(row, customersById, sellersById, productsById),
    );
    const mappedOpportunities = lonaOpportunityRows.flatMap((row) =>
      mapOpportunity(row, customersById, sellersById, productsById),
    );
    const dashboard = buildDashboard(customers, mappedAlerts, referenceDate);

    return {
      referenceDate,
      dashboard,
      customers,
      sellers: buildSellerMetrics(sellers, customers, mappedAlerts),
      products,
      sales,
      saleItems,
      alerts: mappedAlerts,
      opportunities: mappedOpportunities,
      agenda: agendaRows
        .filter((row) => !row.cliente_id || saleClientIds.has(row.cliente_id))
        .map(mapAgenda),
    };
  }

  private async ensureDerivedRepurchaseAlerts(
    sales: SaleRow[],
    items: SaleItemRow[],
    products: ProductRow[],
    referenceDate: string,
    existingAlerts: AlertRow[],
  ) {
    const retainedAlerts = currentRepurchaseAlerts(existingAlerts, sales);
    const retainedIds = new Set(retainedAlerts.map((alert) => alert.id));
    const staleAlerts = existingAlerts.filter((alert) => !retainedIds.has(alert.id));
    await this.client.deleteMany(
      "crm_alertas_recompra",
      "id",
      staleAlerts.map((alert) => alert.id),
    );
    const rows = buildDerivedRepurchaseAlertRows(sales, items, products, referenceDate);
    const existingKeys = new Set(retainedAlerts.map(alertUniqueKey));
    const missingRows = rows.filter((row) => !existingKeys.has(alertUniqueKey(row)));
    if (!missingRows.length) return retainedAlerts;
    return this.client.upsert<AlertRow>(
      "crm_alertas_recompra",
      missingRows,
      "cliente_id,produto_id,venda_id,item_venda_id",
    ).then((insertedRows) => [...retainedAlerts, ...insertedRows]);
  }

  private async ensureDerivedOpportunities(
    clients: ClientRow[],
    sales: SaleRow[],
    items: SaleItemRow[],
    products: ProductRow[],
    referenceDate: string,
  ) {
    const rows = buildDerivedOpportunityRows(clients, sales, items, products, referenceDate);
    if (!rows.length) return [];
    return this.client.insert<OpportunityRow>("crm_oportunidades", rows);
  }
}

function mapSellers(rows: SellerRow[]): CrmSeller[] {
  return rows.map((row) => ({
    id: row.id,
    uniplusId: row.uniplus_id,
    name: row.nome,
    email: row.email ?? "",
    mobile: row.celular ?? "",
    whatsapp: row.whatsapp ?? "",
    supervisor: row.supervisor,
    inactive: row.inativo,
    customerCount: 0,
    riskCustomerCount: 0,
    openAlertCount: 0,
    potentialValue: 0,
    conversionRate: 0,
  }));
}

function mapProducts(rows: ProductRow[]): CrmProduct[] {
  return rows.map((row) => ({
    id: row.id,
    uniplusId: row.uniplus_id,
    code: row.codigo ?? "",
    name: row.nome,
    type: row.tipo ?? "",
    department: row.departamento ?? "",
    supplier: row.fornecedor ?? "",
    price: Number(row.preco ?? 0),
    usesCrm: row.utiliza_crm,
    repurchaseActive: row.recompra_ativa,
    defaultRepurchaseDays: row.dias_recompra_padrao ?? undefined,
  }));
}

function mapSales(rows: SaleRow[]): CrmSale[] {
  return rows.map((row) => ({
    id: row.id,
    uniplusId: row.uniplus_id,
    customerId: row.cliente_id,
    sellerId: row.vendedor_id ?? undefined,
    soldAt: dateOnly(row.data_venda),
    updatedAt: row.updated_at,
    totalValue: Number(row.valor_total ?? 0),
    discountValue: Number(row.valor_desconto ?? 0),
    status: row.status ?? "",
    approved: Boolean(row.aprovado),
  }));
}

function mapSaleItems(rows: SaleItemRow[]): CrmSaleItem[] {
  return rows.map((row) => ({
    id: row.id,
    uniplusId: row.uniplus_id,
    saleId: row.venda_id,
    productId: row.produto_id ?? undefined,
    productCode: row.codigo_produto ?? "",
    productName: row.nome_produto,
    quantity: Number(row.quantidade),
    estimatedValue: Number(row.valor_estimado ?? 0),
  }));
}

function mapCustomers(
  clients: ClientRow[],
  sales: SaleRow[],
  sellers: SellerRow[],
  referenceDate: string,
): CrmCustomer[] {
  const clientUniplusIdById = new Map(clients.map((client) => [client.id, client.uniplus_id]));
  const sellerUniplusIdById = new Map(sellers.map((seller) => [seller.id, seller.uniplus_id]));
  const salesByClientId = new Map<string, SaleRow[]>();
  const sourceSalesByClientId = new Map<string, UniplusSale[]>();

  for (const sale of sales) {
    const clientSales = salesByClientId.get(sale.cliente_id) ?? [];
    clientSales.push(sale);
    salesByClientId.set(sale.cliente_id, clientSales);

    const sourceSales = sourceSalesByClientId.get(sale.cliente_id) ?? [];
    sourceSales.push({
      id: sale.uniplus_id,
      soldAt: dateOnly(sale.data_venda),
      includedAt: dateOnly(sale.data_venda),
      changedAt: dateOnly(sale.data_venda),
      clientId: clientUniplusIdById.get(sale.cliente_id) ?? undefined,
      sellerId: sale.vendedor_id ? sellerUniplusIdById.get(sale.vendedor_id) : undefined,
      totalValue: Number(sale.valor_total ?? 0),
      discountValue: Number(sale.valor_desconto ?? 0),
      status: sale.status ?? "",
      approved: Boolean(sale.aprovado),
    });
    sourceSalesByClientId.set(sale.cliente_id, sourceSales);
  }
  const sourceSellers = sellers.map((seller): UniplusSeller => ({
    id: seller.uniplus_id,
    name: seller.nome,
    email: seller.email ?? undefined,
    mobile: seller.celular ?? undefined,
    whatsapp: seller.whatsapp ?? undefined,
    supervisor: seller.supervisor,
    inactive: seller.inativo,
  }));

  return clients.map((client) => {
    const clientSales = (salesByClientId.get(client.id) ?? [])
      .sort((a, b) => b.data_venda.localeCompare(a.data_venda));
    const lastPurchaseAt = dateOnly(
      clientSales[0]?.data_venda ??
        client.data_ultima_compra ??
        client.data_cadastro ??
        referenceDate,
    );
    const daysWithoutPurchase = daysBetween(lastPurchaseAt, referenceDate);
    const totalPurchased = roundCurrency(
      clientSales.reduce((total, sale) => total + Number(sale.valor_total ?? 0), 0),
    );
    const averageTicket = clientSales.length ? roundCurrency(totalPurchased / clientSales.length) : 0;
    const registrationScore = client.qualidade_cadastro_score ?? 0;
    const activityStatus = classifyCustomerActivity(daysWithoutPurchase);
    const purchaseCycleDays = client.ciclo_compras ?? 45;

    return {
      id: client.id,
      uniplusId: client.uniplus_id ?? 0,
      code: client.codigo ?? "",
      name: client.nome,
      legalName: client.razao_social ?? "",
      document: client.cpf_cnpj ?? "",
      phone: client.telefone ?? "",
      mobile: client.celular ?? "",
      whatsapp: resolveCustomerWhatsApp(client.celular ?? undefined, client.whatsapp ?? undefined) ?? "",
      email: client.email ?? "",
      address: client.endereco ?? "",
      neighborhood: client.bairro ?? "",
      cityId: client.cidade_id ?? undefined,
      city: "",
      stateId: client.estado_id ?? undefined,
      zipCode: client.cep ?? "",
      registeredAt: dateOnly(client.data_cadastro ?? ""),
      lastPurchaseAt,
      inactive: client.inativo,
      category: "Sem categoria",
      purchaseCycleDays,
      registrationQualityScore: registrationScore,
      registrationQualityStatus: client.qualidade_cadastro_status ?? "ruim",
      activityStatus,
      daysWithoutPurchase,
      preferredSeller: client.uniplus_id
        ? calculatePreferredSeller(
            client.uniplus_id,
            sourceSalesByClientId.get(client.id) ?? [],
            sourceSellers,
          )
        : undefined,
      totalPurchases: clientSales.length,
      totalPurchased,
      averageTicket,
      repurchaseScore: calculateRepurchaseScore(activityStatus, registrationScore, clientSales.length),
      potentialLost: calculatePotentialLost(averageTicket, purchaseCycleDays, daysWithoutPurchase),
    };
  });
}

function buildSellerMetrics(
  sellers: CrmSeller[],
  customers: CrmCustomer[],
  alerts: CrmRepurchaseAlert[],
) {
  return sellers.map((seller) => {
    const assignedCustomers = customers.filter(
      (customer) => customer.preferredSeller?.sellerName === seller.name,
    );
    return {
      ...seller,
      customerCount: assignedCustomers.length,
      riskCustomerCount: assignedCustomers.filter(
        (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
      ).length,
      openAlertCount: alerts.filter(
        (alert) => alert.sellerId === seller.id && alert.status === "pendente",
      ).length,
      potentialValue: roundCurrency(
        assignedCustomers.reduce((total, customer) => total + customer.potentialLost, 0),
      ),
      conversionRate: Math.min(96, 58 + assignedCustomers.length * 7),
    };
  });
}

function currentRepurchaseAlerts(alerts: AlertRow[], sales: SaleRow[]) {
  const latestSaleByCustomer = new Map<string, string>();
  for (const sale of sales) {
    if (!sale.aprovado) continue;
    const soldAt = dateOnly(sale.data_venda);
    const current = latestSaleByCustomer.get(sale.cliente_id);
    if (!current || soldAt > current) latestSaleByCustomer.set(sale.cliente_id, soldAt);
  }

  return alerts.filter((alert) => {
    const latestSale = latestSaleByCustomer.get(alert.cliente_id);
    return !latestSale || latestSale <= dateOnly(alert.data_compra);
  });
}

function mapAlert(
  row: AlertRow,
  customers: Map<string, CrmCustomer>,
  sellers: Map<string, CrmSeller>,
  products: Map<string, CrmProduct>,
): CrmRepurchaseAlert[] {
  const customer = customers.get(row.cliente_id);
  if (!customer) return [];
  const product = row.produto_id ? products.get(row.produto_id) : undefined;
  const seller = row.vendedor_responsavel_id ? sellers.get(row.vendedor_responsavel_id) : undefined;
  return [{
    id: row.id,
    customerId: customer.id,
    customerName: customer.name,
    productId: product?.id,
    productName: product?.name ?? "Produto nao informado",
    sellerId: seller?.id,
    sellerName: seller?.name ?? "Nao atribuido",
    saleId: row.venda_id,
    saleItemId: row.item_venda_id,
    purchaseDate: dateOnly(row.data_compra),
    expectedDate: row.data_prevista_recompra,
    repurchaseDays: row.dias_recompra,
    status: row.status,
    priority: row.prioridade,
    origin: row.origem,
    department: product?.department ?? "",
    note: row.observacao ?? undefined,
  }];
}

function mapOpportunity(
  row: OpportunityRow,
  customers: Map<string, CrmCustomer>,
  sellers: Map<string, CrmSeller>,
  products: Map<string, CrmProduct>,
): CrmOpportunity[] {
  const customer = customers.get(row.cliente_id);
  if (!customer) return [];
  const seller = row.vendedor_responsavel_id ? sellers.get(row.vendedor_responsavel_id) : undefined;
  const product = row.produto_origem_id ? products.get(row.produto_origem_id) : undefined;
  return [{
    id: row.id,
    customerId: customer.id,
    customerName: customer.name,
    sourceProductName: product?.name ?? "Produto nao informado",
    suggestedProductName: row.produto_sugerido_nome,
    reason: row.motivo ?? "",
    confidence: row.confianca ?? 0,
    status: row.status,
    sellerId: seller?.id,
    sellerName: seller?.name ?? "Nao atribuido",
  }];
}

function isLonaOpportunityRow(row: OpportunityRow) {
  return normalizeOpportunityProductName(row.produto_sugerido_nome).includes("lona");
}

function buildDerivedRepurchaseAlertRows(
  sales: SaleRow[],
  items: SaleItemRow[],
  products: ProductRow[],
  referenceDate: string,
) {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const latestSaleDateByCustomer = new Map<string, string>();
  for (const sale of sales) {
    if (!sale.aprovado) continue;
    const soldAt = dateOnly(sale.data_venda);
    const current = latestSaleDateByCustomer.get(sale.cliente_id);
    if (!current || soldAt > current) latestSaleDateByCustomer.set(sale.cliente_id, soldAt);
  }
  const latestByCustomerProduct = new Map<string, { sale: SaleRow; item: SaleItemRow; product: ProductRow }>();
  const horizonDate = addDays(referenceDate, 15);

  for (const item of items) {
    if (!item.produto_id) continue;
    const sale = salesById.get(item.venda_id);
    const product = productsById.get(item.produto_id);
    if (!sale || !product || !sale.aprovado) continue;
    if (dateOnly(sale.data_venda) !== latestSaleDateByCustomer.get(sale.cliente_id)) continue;
    if (!product.recompra_ativa && !product.utiliza_crm) continue;

    const key = `${sale.cliente_id}:${item.produto_id}`;
    const current = latestByCustomerProduct.get(key);
    if (!current || sale.data_venda > current.sale.data_venda) {
      latestByCustomerProduct.set(key, { sale, item, product });
    }
  }

  return [...latestByCustomerProduct.values()]
    .map(({ sale, item, product }) => {
      const repurchaseDays = resolveRepurchaseDays(product);
      const purchaseDate = dateOnly(sale.data_venda);
      const expectedDate = addDays(purchaseDate, repurchaseDays);
      if (expectedDate > horizonDate) return null;

      return {
        cliente_id: sale.cliente_id,
        produto_id: product.id,
        venda_id: sale.id,
        item_venda_id: item.id,
        vendedor_responsavel_id: sale.vendedor_id,
        data_compra: sale.data_venda,
        data_prevista_recompra: expectedDate,
        dias_recompra: repurchaseDays,
        status: "pendente",
        prioridade: resolveAlertPriority(expectedDate, referenceDate),
        origem: product.dias_recompra_padrao ? "regra_produto" : "historico_cliente",
        observacao: "Gerado automaticamente pelo Hennder CRM a partir das vendas reais.",
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => left.data_prevista_recompra.localeCompare(right.data_prevista_recompra))
    .slice(0, 500);
}

function buildDerivedOpportunityRows(
  clients: ClientRow[],
  sales: SaleRow[],
  items: SaleItemRow[],
  products: ProductRow[],
  referenceDate: string,
) {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByCustomer = new Map<string, Set<string>>();
  const latestSaleByCustomer = new Map<string, SaleRow>();
  const productStats = new Map<string, { product: ProductRow; sales: number; revenue: number }>();

  for (const sale of sales) {
    if (!sale.aprovado) continue;
    const current = latestSaleByCustomer.get(sale.cliente_id);
    if (!current || sale.data_venda > current.data_venda) latestSaleByCustomer.set(sale.cliente_id, sale);
  }

  for (const item of items) {
    if (!item.produto_id) continue;
    const sale = salesById.get(item.venda_id);
    const product = productsById.get(item.produto_id);
    if (!sale || !product || !sale.aprovado) continue;

    const customerProducts = productsByCustomer.get(sale.cliente_id) ?? new Set<string>();
    customerProducts.add(product.id);
    productsByCustomer.set(sale.cliente_id, customerProducts);

    const current = productStats.get(product.id) ?? { product, sales: 0, revenue: 0 };
    current.sales += 1;
    current.revenue += Number(item.valor_estimado ?? 0);
    productStats.set(product.id, current);
  }

  const topProducts = [...productStats.values()]
    .filter((item) => (item.product.recompra_ativa || item.product.utiliza_crm) && isLonaProduct(item.product))
    .sort((left, right) => right.revenue - left.revenue || right.sales - left.sales)
    .slice(0, 80);

  return clients
    .flatMap((client) => {
      const latestSale = latestSaleByCustomer.get(client.id);
      if (!latestSale) return [];
      const lastPurchaseDate = dateOnly(latestSale.data_venda);
      const daysWithoutPurchase = daysBetween(lastPurchaseDate, referenceDate);
      if (daysWithoutPurchase < 30) return [];

      const purchasedProductIds = productsByCustomer.get(client.id) ?? new Set<string>();
      const suggested = topProducts.find((item) => !purchasedProductIds.has(item.product.id));
      if (!suggested) return [];

      const confidence = Math.min(95, 58 + Math.floor(daysWithoutPurchase / 3));
      return [{
        cliente_id: client.id,
        produto_origem_id: suggested.product.id,
        produto_sugerido_nome: suggested.product.nome,
        motivo: `Cliente sem compra ha ${daysWithoutPurchase} dias; produto recorrente com bom desempenho na base.`,
        confianca: confidence,
        status: "aberta",
        vendedor_responsavel_id: latestSale.vendedor_id,
      }];
    })
    .sort((left, right) => (right.confianca ?? 0) - (left.confianca ?? 0))
    .slice(0, 150);
}

function isLonaProduct(product: ProductRow) {
  return normalizeOpportunityProductName(product.nome).includes("lona");
}

function normalizeOpportunityProductName(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveRepurchaseDays(product: ProductRow) {
  if (product.dias_recompra_padrao && product.dias_recompra_padrao > 0) return product.dias_recompra_padrao;
  const text = `${product.nome} ${product.departamento ?? ""}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR");
  if (/(SACHE|PETISCO)/u.test(text)) return 20;
  if (/(RACAO|AREIA HIGI)/u.test(text)) return 30;
  if (/(VERM|ANTIPULG|CARRAP|VACINA)/u.test(text)) return 90;
  if (text.includes("VETERINARIA")) return 90;
  if (text.includes("AGRO")) return 60;
  return 45;
}

function resolveAlertPriority(expectedDate: string, referenceDate: string): CrmRepurchaseAlert["priority"] {
  if (expectedDate <= referenceDate) return "alta";
  if (expectedDate <= addDays(referenceDate, 7)) return "media";
  return "baixa";
}

function alertUniqueKey(row: {
  cliente_id: string;
  produto_id: string | null;
  venda_id: string;
  item_venda_id: string;
}) {
  return `${row.cliente_id}:${row.produto_id ?? ""}:${row.venda_id}:${row.item_venda_id}`;
}

function mapAgenda(row: AgendaRow): CrmAgendaEvent {
  const contactId = contactIdFromFollowUpNote(row.observacao);
  return {
    id: row.id,
    date: row.data_evento,
    time: row.hora_evento.slice(0, 5),
    title: row.titulo,
    type: row.tipo,
    customerId: row.cliente_id ?? undefined,
    sellerId: row.vendedor_id ?? undefined,
    completed: row.concluido,
    note: row.observacao ?? undefined,
    contactId,
  };
}

function contactIdFromFollowUpNote(note: string | null) {
  const prefix = "crm_follow_up_contact:";
  const value = note?.trim() ?? "";
  return value.startsWith(prefix) ? value.slice(prefix.length) || undefined : undefined;
}

function buildDashboard(
  customers: CrmCustomer[],
  alerts: CrmRepurchaseAlert[],
  referenceDate: string,
): CrmDashboard {
  const qualityTotal = customers.reduce(
    (total, customer) => total + customer.registrationQualityScore,
    0,
  );
  return {
    activeCustomers: customers.filter((customer) => customer.activityStatus === "ativo").length,
    attentionCustomers: customers.filter((customer) => customer.activityStatus === "atencao").length,
    riskCustomers: customers.filter((customer) => customer.activityStatus === "risco").length,
    lostCustomers: customers.filter((customer) => customer.activityStatus === "perdido").length,
    alertsToday: alerts.filter((alert) => alert.expectedDate === referenceDate).length,
    recoverableRevenue: roundCurrency(
      customers
        .filter((customer) => customer.activityStatus !== "ativo")
        .reduce((total, customer) => total + customer.averageTicket, 0),
    ),
    potentialLost: roundCurrency(
      customers.reduce((total, customer) => total + customer.potentialLost, 0),
    ),
    averageRegistrationQuality: customers.length ? Math.round(qualityTotal / customers.length) : 0,
  };
}

function dateOnly(value: string) {
  return value ? value.slice(0, 10) : "";
}
