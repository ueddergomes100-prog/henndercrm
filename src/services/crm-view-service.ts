import { MOCK_REFERENCE_DATE } from "@/data/mock-uniplus";
import { crmUuid } from "@/domain/crm/rules";
import type {
  CrmAgendaEvent,
  CrmCustomer,
  CrmRepurchaseAlert,
  CrmSnapshot,
} from "@/domain/crm/types";
import { crmDemoService } from "./crm-demo-service";

export interface CustomerViewModel {
  id: string;
  uniplusId: number;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  document: string;
  address: string;
  neighborhood: string;
  cityId?: number;
  city: string;
  category: string;
  status: string;
  activityStatus: CrmCustomer["activityStatus"];
  lastBuy: string;
  lastBuyIso: string;
  days: number;
  ticket: string;
  ticketValue: number;
  score: number;
  potential: string;
  potentialValue: number;
  probability: number;
  preferredSeller: string;
  preferredSellerId?: string;
  sellerAffinity: number;
  qualityScore: number;
  qualityStatus: CrmCustomer["registrationQualityStatus"];
  purchaseCycleDays: number;
  totalPurchases: number;
  totalPurchased: string;
}

export interface AlertViewModel {
  id: string;
  customerId: string;
  product: string;
  client: string;
  buyDate: string;
  buyDateIso: string;
  days: string;
  recommended: string;
  recommendedIso: string;
  priority: string;
  priorityCode: CrmRepurchaseAlert["priority"];
  seller: string;
  department: string;
  status: CrmRepurchaseAlert["status"];
  origin: CrmRepurchaseAlert["origin"];
}

export interface CrmViewModel {
  snapshot: CrmSnapshot;
  kpis: Array<{
    label: string;
    value: string;
    delta: string;
    tone: "purple" | "blue" | "orange" | "green" | "navy" | "teal";
  }>;
  customers: CustomerViewModel[];
  alerts: AlertViewModel[];
  opportunities: Array<{
    client: string;
    customerId: string;
    product: string;
    suggestions: string[];
    confidence: number;
    seller: string;
  }>;
  agenda: Array<CrmAgendaEvent & { color: string }>;
  reportBars: Array<{ name: string; value: number }>;
  repurchaseTrend: Array<{ mes: string; recompra: number; recuperados: number }>;
  categoryData: Array<{ name: string; value: number; color: string }>;
}

export class CrmViewService {
  getViewModel(snapshot = crmDemoService.getSnapshot()): CrmViewModel {
    const customers = snapshot.customers.map(mapCustomer);
    const groupedOpportunities = new Map<
      string,
      CrmViewModel["opportunities"][number]
    >();

    for (const opportunity of snapshot.opportunities) {
      const current = groupedOpportunities.get(opportunity.customerId);
      if (current) {
        current.suggestions.push(opportunity.suggestedProductName);
        current.confidence = Math.max(current.confidence, opportunity.confidence);
      } else {
        groupedOpportunities.set(opportunity.customerId, {
          client: opportunity.customerName,
          customerId: opportunity.customerId,
          product: opportunity.sourceProductName,
          suggestions: [opportunity.suggestedProductName],
          confidence: opportunity.confidence,
          seller: opportunity.sellerName,
        });
      }
    }

    return {
      snapshot,
      kpis: [
        {
          label: "Clientes ativos",
          value: String(snapshot.dashboard.activeCustomers),
          delta: "Até 30 dias",
          tone: "purple",
        },
        {
          label: "Em atenção",
          value: String(snapshot.dashboard.attentionCustomers),
          delta: "31 a 60 dias",
          tone: "blue",
        },
        {
          label: "Em risco",
          value: String(snapshot.dashboard.riskCustomers),
          delta: "61 a 90 dias",
          tone: "orange",
        },
        {
          label: "Clientes perdidos",
          value: String(snapshot.dashboard.lostCustomers),
          delta: "+90 dias",
          tone: "green",
        },
        {
          label: "Potencial perdido",
          value: formatCurrency(snapshot.dashboard.potentialLost),
          delta: "Estimado",
          tone: "navy",
        },
        {
          label: "Qualidade da base",
          value: `${snapshot.dashboard.averageRegistrationQuality}%`,
          delta: "Média",
          tone: "teal",
        },
      ],
      customers,
      alerts: snapshot.alerts.map((alert) => ({
        id: alert.id,
        customerId: alert.customerId,
        product: alert.productName,
        client: alert.customerName,
        buyDate: formatDate(alert.purchaseDate),
        buyDateIso: alert.purchaseDate,
        days: `${alert.repurchaseDays} dias`,
        recommended: formatDate(alert.expectedDate),
        recommendedIso: alert.expectedDate,
        priority: capitalize(alert.priority),
        priorityCode: alert.priority,
        seller: alert.sellerName,
        department: alert.department,
        status: alert.status,
        origin: alert.origin,
      })),
      opportunities: [...groupedOpportunities.values()],
      agenda: snapshot.agenda.map((event) => ({
        ...event,
        color: agendaColor(event.type),
      })),
      reportBars: [
        { name: "Ativos", value: snapshot.dashboard.activeCustomers },
        { name: "Atenção", value: snapshot.dashboard.attentionCustomers },
        { name: "Risco", value: snapshot.dashboard.riskCustomers },
        { name: "Perdidos", value: snapshot.dashboard.lostCustomers },
        { name: "Alertas", value: snapshot.alerts.length },
      ],
      repurchaseTrend: buildRepurchaseTrend(snapshot),
      categoryData: buildCategoryData(snapshot),
    };
  }
}

export const crmViewService = new CrmViewService();
export const crmViewModel = crmViewService.getViewModel();
export const crmReferenceDate = MOCK_REFERENCE_DATE;

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`),
  );
}

function mapCustomer(customer: CrmCustomer): CustomerViewModel {
  return {
    id: customer.id,
    uniplusId: customer.uniplusId,
    name: customer.name,
    phone: customer.mobile || customer.whatsapp || customer.phone,
    whatsapp: customer.whatsapp,
    email: customer.email,
    document: customer.document,
    address: customer.address,
    neighborhood: customer.neighborhood,
    cityId: customer.cityId,
    city: customer.city,
    category: customer.category,
    status: activityStatusLabel(customer.activityStatus),
    activityStatus: customer.activityStatus,
    lastBuy: formatDate(customer.lastPurchaseAt),
    lastBuyIso: customer.lastPurchaseAt,
    days: customer.daysWithoutPurchase,
    ticket: formatCurrency(customer.averageTicket),
    ticketValue: customer.averageTicket,
    score: customer.repurchaseScore,
    potential: formatCurrency(customer.potentialLost),
    potentialValue: customer.potentialLost,
    probability: customer.repurchaseScore,
    preferredSeller: customer.preferredSeller?.sellerName ?? "Sem preferência",
    preferredSellerId: customer.preferredSeller
      ? crmUuid("seller", customer.preferredSeller.sellerId)
      : undefined,
    sellerAffinity: customer.preferredSeller?.relationshipPercentage ?? 0,
    qualityScore: customer.registrationQualityScore,
    qualityStatus: customer.registrationQualityStatus,
    purchaseCycleDays: customer.purchaseCycleDays,
    totalPurchases: customer.totalPurchases,
    totalPurchased: formatCurrency(customer.totalPurchased),
  };
}

function activityStatusLabel(status: CrmCustomer["activityStatus"]) {
  return {
    ativo: "Ativo",
    atencao: "Atenção",
    risco: "Em risco",
    perdido: "Perdido",
  }[status];
}

function agendaColor(type: CrmAgendaEvent["type"]) {
  return {
    Ligacao: "bg-emerald-500",
    Visita: "bg-blue-500",
    Retorno: "bg-amber-500",
    Recompra: "bg-teal-500",
  }[type];
}

function capitalize(value: string) {
  return `${value.charAt(0).toLocaleUpperCase("pt-BR")}${value.slice(1)}`;
}

function buildRepurchaseTrend(snapshot: CrmSnapshot) {
  const months = [
    ["01", "Jan"],
    ["02", "Fev"],
    ["03", "Mar"],
    ["04", "Abr"],
    ["05", "Mai"],
    ["06", "Jun"],
  ] as const;

  return months.map(([month, label]) => {
    const sales = snapshot.sales.filter((sale) => sale.soldAt.slice(5, 7) === month);
    const recurringCustomers = new Set(
      sales
        .map((sale) => sale.customerId)
        .filter((customerId) => snapshot.sales.filter((sale) => sale.customerId === customerId).length > 1),
    );
    return {
      mes: label,
      recompra: sales.length,
      recuperados: recurringCustomers.size,
    };
  });
}

function buildCategoryData(snapshot: CrmSnapshot) {
  const productById = new Map(snapshot.products.map((product) => [product.id, product]));
  const totals = new Map<string, number>();

  for (const item of snapshot.saleItems) {
    const department = item.productId
      ? productById.get(item.productId)?.department || "Outros"
      : "Outros";
    totals.set(department, (totals.get(department) ?? 0) + item.estimatedValue);
  }

  const grandTotal = [...totals.values()].reduce((total, value) => total + value, 0) || 1;
  const colors = ["#16a34a", "#0f766e", "#f59e0b", "#2563eb"];
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value], index) => ({
      name,
      value: Math.round((value / grandTotal) * 100),
      color: colors[index],
    }));
}
