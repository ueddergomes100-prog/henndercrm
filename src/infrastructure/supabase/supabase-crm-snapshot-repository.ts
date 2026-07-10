import "server-only";

import {
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
  uniplus_id: number;
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
};

export class SupabaseCrmSnapshotRepository implements ICrmSnapshotRepository {
  constructor(private readonly client = new SupabaseRestClient()) {}

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
          select: "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id",
          order: "data_evento.asc,hora_evento.asc",
        }),
      ]);

    const sellers = mapSellers(sellerRows);
    const sales = mapSales(saleRows);
    const saleItems = mapSaleItems(itemRows);
    const products = mapProducts(productRows);
    const customers = mapCustomers(clientRows, saleRows, sellerRows, referenceDate);
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const dashboard = buildDashboard(customers, alertRows, referenceDate);

    return {
      referenceDate,
      dashboard,
      customers,
      sellers: buildSellerMetrics(sellers, customers, alertRows),
      products,
      sales,
      saleItems,
      alerts: alertRows.flatMap((row) =>
        mapAlert(row, customersById, sellersById, productsById),
      ),
      opportunities: opportunityRows.flatMap((row) =>
        mapOpportunity(row, customersById, sellersById, productsById),
      ),
      agenda: agendaRows.map(mapAgenda),
    };
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
  const sourceSales = sales.map((sale): UniplusSale => ({
    id: sale.uniplus_id,
    soldAt: dateOnly(sale.data_venda),
    includedAt: dateOnly(sale.data_venda),
    changedAt: dateOnly(sale.data_venda),
    clientId: clients.find((client) => client.id === sale.cliente_id)?.uniplus_id,
    sellerId: sellers.find((seller) => seller.id === sale.vendedor_id)?.uniplus_id,
    totalValue: Number(sale.valor_total ?? 0),
    discountValue: Number(sale.valor_desconto ?? 0),
    status: sale.status ?? "",
    approved: Boolean(sale.aprovado),
  }));
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
    const clientSales = sales
      .filter((sale) => sale.cliente_id === client.id)
      .sort((a, b) => b.data_venda.localeCompare(a.data_venda));
    const lastPurchaseAt = dateOnly(clientSales[0]?.data_venda ?? client.data_ultima_compra ?? referenceDate);
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
      uniplusId: client.uniplus_id,
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
      preferredSeller: calculatePreferredSeller(client.uniplus_id, sourceSales, sourceSellers),
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
  alerts: AlertRow[],
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
        (alert) => alert.vendedor_responsavel_id === seller.id && alert.status === "pendente",
      ).length,
      potentialValue: roundCurrency(
        assignedCustomers.reduce((total, customer) => total + customer.potentialLost, 0),
      ),
      conversionRate: Math.min(96, 58 + assignedCustomers.length * 7),
    };
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

function mapAgenda(row: AgendaRow): CrmAgendaEvent {
  return {
    id: row.id,
    date: row.data_evento,
    time: row.hora_evento.slice(0, 5),
    title: row.titulo,
    type: row.tipo,
    customerId: row.cliente_id ?? undefined,
    sellerId: row.vendedor_id ?? undefined,
  };
}

function buildDashboard(
  customers: CrmCustomer[],
  alerts: AlertRow[],
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
    alertsToday: alerts.filter((alert) => alert.data_prevista_recompra === referenceDate).length,
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
