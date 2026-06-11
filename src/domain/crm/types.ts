export type CustomerActivityStatus = "ativo" | "atencao" | "risco" | "perdido";
export type RegistrationQualityStatus = "ruim" | "regular" | "bom" | "excelente";
export type RepurchaseAlertStatus = "pendente" | "contatado" | "convertido" | "perdido" | "ignorado";
export type RepurchaseAlertOrigin =
  | "regra_produto"
  | "regra_departamento"
  | "historico_cliente"
  | "manual"
  | "ia";
export type ContactChannel = "WhatsApp" | "Telefone" | "Visita" | "Presencial" | "Email";
export type ContactOutcome =
  | "not_interested"
  | "follow_up"
  | "no_answer"
  | "interested"
  | "invalid_number";
export type CrmUserRole = "administrador" | "supervisor" | "vendedor";

export interface CrmSessionUser {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  sellerId?: string;
}

export interface UniplusClient {
  id: number;
  code: string;
  name: string;
  legalName?: string;
  document?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  cityId?: number;
  cityName?: string;
  stateId?: number;
  zipCode?: string;
  registeredAt?: string;
  lastPurchaseAt?: string;
  inactive: boolean;
  categoryId?: number;
  categoryName?: string;
  classificationId?: number;
  purchaseCycleDays?: number;
}

export interface UniplusSeller {
  id: number;
  name: string;
  email?: string;
  mobile?: string;
  whatsapp?: string;
  supervisor: boolean;
  inactive: boolean;
  profileId?: number;
}

export interface UniplusProduct {
  id: number;
  code: string;
  name: string;
  type?: string;
  department?: string;
  manufacturerId?: number;
  supplier?: string;
  price: number;
  lastSaleAt?: string;
  lastPurchaseAt?: string;
  productType?: string;
  usesCrm: boolean;
}

export interface UniplusSale {
  id: number;
  soldAt: string;
  includedAt: string;
  changedAt: string;
  clientId?: number;
  clientName?: string;
  clientDocument?: string;
  sellerId?: number;
  totalValue: number;
  discountValue: number;
  status: string;
  approved: boolean;
  cancelledAt?: string;
}

export interface UniplusSaleItem {
  id: number;
  saleId: number;
  productId?: number;
  productCode?: string;
  productName?: string;
  quantity: number;
  includedAt: string;
}

export interface RepurchaseRule {
  id: string;
  type: "produto" | "departamento" | "palavra_chave" | "manual_cliente_produto";
  productId?: number;
  department?: string;
  keyword?: string;
  days: number;
  priority: number;
  active: boolean;
  note?: string;
}

export interface SellerAffinity {
  sellerId: number;
  sellerName: string;
  purchaseCount: number;
  totalValue: number;
  lastPurchaseAt: string;
  relationshipPercentage: number;
}

export interface CrmCustomer {
  id: string;
  uniplusId: number;
  code: string;
  name: string;
  legalName: string;
  document: string;
  phone: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  neighborhood: string;
  cityId?: number;
  city: string;
  stateId?: number;
  zipCode: string;
  registeredAt: string;
  lastPurchaseAt: string;
  inactive: boolean;
  category: string;
  purchaseCycleDays: number;
  registrationQualityScore: number;
  registrationQualityStatus: RegistrationQualityStatus;
  activityStatus: CustomerActivityStatus;
  daysWithoutPurchase: number;
  preferredSeller?: SellerAffinity;
  totalPurchases: number;
  totalPurchased: number;
  averageTicket: number;
  repurchaseScore: number;
  potentialLost: number;
}

export interface CrmSeller {
  id: string;
  uniplusId: number;
  name: string;
  email: string;
  mobile: string;
  whatsapp: string;
  supervisor: boolean;
  inactive: boolean;
  customerCount: number;
  riskCustomerCount: number;
  openAlertCount: number;
  potentialValue: number;
  conversionRate: number;
}

export interface CrmProduct {
  id: string;
  uniplusId: number;
  code: string;
  name: string;
  type: string;
  department: string;
  supplier: string;
  price: number;
  usesCrm: boolean;
  repurchaseActive: boolean;
  defaultRepurchaseDays?: number;
}

export interface CrmSale {
  id: string;
  uniplusId: number;
  customerId: string;
  sellerId?: string;
  soldAt: string;
  totalValue: number;
  discountValue: number;
  status: string;
  approved: boolean;
}

export interface CrmSaleItem {
  id: string;
  uniplusId: number;
  saleId: string;
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  estimatedValue: number;
}

export interface CrmRepurchaseAlert {
  id: string;
  customerId: string;
  customerName: string;
  productId?: string;
  productName: string;
  sellerId?: string;
  sellerName: string;
  saleId: string;
  saleItemId: string;
  purchaseDate: string;
  expectedDate: string;
  repurchaseDays: number;
  status: RepurchaseAlertStatus;
  priority: "alta" | "media" | "baixa";
  origin: RepurchaseAlertOrigin;
  department: string;
  note?: string;
}

export interface CrmOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  sourceProductName: string;
  suggestedProductName: string;
  reason: string;
  confidence: number;
  status: "aberta" | "em_contato" | "convertida" | "descartada";
  sellerId?: string;
  sellerName: string;
}

export interface CrmAgendaEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  type: "Ligacao" | "Visita" | "Retorno" | "Recompra";
  customerId?: string;
  sellerId?: string;
}

export interface CrmContactRecord {
  id: number | string;
  customerId: string;
  customerName: string;
  outcome: ContactOutcome;
  note: string;
  nextContact: string;
  contactedAt: string;
  channel: ContactChannel;
  responsible: string;
}

export interface CrmWorkspace {
  contacts: CrmContactRecord[];
  alertStatuses: Record<string, RepurchaseAlertStatus>;
  opportunities: CrmOpportunity[];
  agenda: CrmAgendaEvent[];
}

export interface CrmDashboard {
  activeCustomers: number;
  attentionCustomers: number;
  riskCustomers: number;
  lostCustomers: number;
  alertsToday: number;
  recoverableRevenue: number;
  potentialLost: number;
  averageRegistrationQuality: number;
}

export interface CrmSnapshot {
  referenceDate: string;
  dashboard: CrmDashboard;
  customers: CrmCustomer[];
  sellers: CrmSeller[];
  products: CrmProduct[];
  sales: CrmSale[];
  saleItems: CrmSaleItem[];
  alerts: CrmRepurchaseAlert[];
  opportunities: CrmOpportunity[];
  agenda: CrmAgendaEvent[];
}

export interface IgnoredSale {
  saleId: number;
  reason:
    | "cliente_nao_identificado"
    | "venda_cancelada"
    | "item_sem_produto"
    | "cliente_inativo"
    | "dados_incompletos";
  data: unknown;
}

export interface SyncResult {
  startedAt: string;
  finishedAt: string;
  totalRead: number;
  totalImported: number;
  totalIgnored: number;
  ignoredSales: IgnoredSale[];
}
