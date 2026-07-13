import type { CrmContactRecord, CrmSale } from "@/domain/crm/types";
import type { CustomerViewModel } from "@/services/crm-view-service";

const DAY_IN_MS = 86_400_000;

export const crmAttributionWindows = [
  {
    id: "recovered_10",
    label: "0-10 dias",
    description: "Compra ate 10 dias apos contato ou acao registrada.",
    minDays: 0,
    maxDays: 10,
    weight: 1,
    kind: "recovered",
  },
  {
    id: "influenced_20",
    label: "11-20 dias",
    description: "Compra entre 11 e 20 dias apos contato ou acao registrada.",
    minDays: 11,
    maxDays: 20,
    weight: 0.75,
    kind: "influenced",
  },
  {
    id: "influenced_30",
    label: "21-30 dias",
    description: "Compra entre 21 e 30 dias apos contato ou acao registrada.",
    minDays: 21,
    maxDays: 30,
    weight: 0.5,
    kind: "influenced",
  },
] as const;

export type CrmAttributionWindow = (typeof crmAttributionWindows)[number];

export type CrmAttributedSale = {
  sale: CrmSale;
  customer?: CustomerViewModel;
  contact: CrmContactRecord;
  daysAfterContact: number;
  window: CrmAttributionWindow;
  weightedValue: number;
};

export type CrmAttributionSummary = {
  recoveredRevenue: number;
  influencedRevenue: number;
  totalAttributedRevenue: number;
  grossAttributedRevenue: number;
  recoveredSales: CrmAttributedSale[];
  influencedSales: CrmAttributedSale[];
  attributedSales: CrmAttributedSale[];
  contactedCustomers: number;
  convertedCustomers: number;
  conversionRate: number;
  averageRecoveredTicket: number;
  windowRows: Array<{
    id: string;
    label: string;
    description: string;
    sales: number;
    customers: number;
    grossValue: number;
    weightedValue: number;
    weight: number;
    kind: CrmAttributionWindow["kind"];
  }>;
  customerRows: Array<{
    customerId: string;
    customerName: string;
    sellerName: string;
    sales: number;
    grossValue: number;
    weightedValue: number;
    bestWindow: string;
  }>;
};

export function buildCrmAttributionSummary({
  customers,
  sales,
  contactRecords,
}: {
  customers: CustomerViewModel[];
  sales: CrmSale[];
  contactRecords: CrmContactRecord[];
}): CrmAttributionSummary {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const eligibleContacts = contactRecords
    .filter((record) => record.outcome !== "invalid_number")
    .map((record) => ({ record, date: parseCrmDate(record.contactedAt) }))
    .filter((item): item is { record: CrmContactRecord; date: Date } => Boolean(item.date));

  const contactsByCustomer = new Map<string, Array<{ record: CrmContactRecord; date: Date }>>();
  for (const contact of eligibleContacts) {
    const current = contactsByCustomer.get(contact.record.customerId) ?? [];
    current.push(contact);
    contactsByCustomer.set(contact.record.customerId, current);
  }

  for (const contacts of contactsByCustomer.values()) {
    contacts.sort((left, right) => right.date.getTime() - left.date.getTime());
  }

  const attributedSales = sales
    .filter((sale) => sale.approved)
    .flatMap((sale): CrmAttributedSale[] => {
      const saleDate = parseCrmDate(sale.soldAt);
      if (!saleDate) return [];

      const candidate = (contactsByCustomer.get(sale.customerId) ?? [])
        .map((contact) => ({
          contact,
          days: daysBetween(contact.date, saleDate),
        }))
        .filter((item) => item.days >= 0 && item.days <= 30)
        .sort((left, right) => left.days - right.days)[0];

      if (!candidate) return [];

      const window = crmAttributionWindows.find(
        (item) => candidate.days >= item.minDays && candidate.days <= item.maxDays,
      );
      if (!window) return [];

      return [{
        sale,
        customer: customersById.get(sale.customerId),
        contact: candidate.contact.record,
        daysAfterContact: candidate.days,
        window,
        weightedValue: roundCurrency(sale.totalValue * window.weight),
      }];
    });

  const recoveredSales = attributedSales.filter((item) => item.window.kind === "recovered");
  const influencedSales = attributedSales.filter((item) => item.window.kind === "influenced");
  const recoveredRevenue = sum(recoveredSales.map((item) => item.weightedValue));
  const influencedRevenue = sum(influencedSales.map((item) => item.weightedValue));
  const convertedCustomerIds = new Set(attributedSales.map((item) => item.sale.customerId));
  const contactedCustomerIds = new Set(eligibleContacts.map((item) => item.record.customerId));

  return {
    recoveredRevenue,
    influencedRevenue,
    totalAttributedRevenue: roundCurrency(recoveredRevenue + influencedRevenue),
    grossAttributedRevenue: sum(attributedSales.map((item) => item.sale.totalValue)),
    recoveredSales,
    influencedSales,
    attributedSales,
    contactedCustomers: contactedCustomerIds.size,
    convertedCustomers: convertedCustomerIds.size,
    conversionRate: contactedCustomerIds.size
      ? Math.round((convertedCustomerIds.size / contactedCustomerIds.size) * 100)
      : 0,
    averageRecoveredTicket: recoveredSales.length ? roundCurrency(recoveredRevenue / recoveredSales.length) : 0,
    windowRows: buildWindowRows(attributedSales),
    customerRows: buildCustomerRows(attributedSales),
  };
}

function buildWindowRows(attributedSales: CrmAttributedSale[]): CrmAttributionSummary["windowRows"] {
  return crmAttributionWindows.map((window) => {
    const sales = attributedSales.filter((item) => item.window.id === window.id);
    return {
      id: window.id,
      label: window.label,
      description: window.description,
      sales: sales.length,
      customers: new Set(sales.map((item) => item.sale.customerId)).size,
      grossValue: sum(sales.map((item) => item.sale.totalValue)),
      weightedValue: sum(sales.map((item) => item.weightedValue)),
      weight: window.weight,
      kind: window.kind,
    };
  });
}

function buildCustomerRows(attributedSales: CrmAttributedSale[]): CrmAttributionSummary["customerRows"] {
  const rows = new Map<string, CrmAttributionSummary["customerRows"][number]>();
  for (const item of attributedSales) {
    const current = rows.get(item.sale.customerId) ?? {
      customerId: item.sale.customerId,
      customerName: item.customer?.name ?? item.contact.customerName,
      sellerName: item.customer?.preferredSeller ?? item.contact.responsible,
      sales: 0,
      grossValue: 0,
      weightedValue: 0,
      bestWindow: item.window.label,
    };
    current.sales += 1;
    current.grossValue = roundCurrency(current.grossValue + item.sale.totalValue);
    current.weightedValue = roundCurrency(current.weightedValue + item.weightedValue);
    if (item.window.weight > (crmAttributionWindows.find((window) => window.label === current.bestWindow)?.weight ?? 0)) {
      current.bestWindow = item.window.label;
    }
    rows.set(item.sale.customerId, current);
  }

  return [...rows.values()].sort((left, right) => right.weightedValue - left.weightedValue);
}

function parseCrmDate(value: string) {
  const rawValue = value.trim();
  if (!rawValue) return undefined;

  const brazilianDate = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/u);
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate;
    return new Date(`${year}-${month}-${day}T12:00:00Z`);
  }

  const dateOnly = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (dateOnly) return new Date(`${rawValue}T12:00:00Z`);

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function daysBetween(start: Date, end: Date) {
  const startDate = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDate = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endDate - startDate) / DAY_IN_MS);
}

function sum(values: number[]) {
  return roundCurrency(values.reduce((total, value) => total + value, 0));
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
