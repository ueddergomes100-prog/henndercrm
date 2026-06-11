import type {
  CustomerActivityStatus,
  RegistrationQualityStatus,
  RepurchaseRule,
  SellerAffinity,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "./types";

const DAY_IN_MS = 86_400_000;

export function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start.slice(0, 10)}T12:00:00Z`);
  const endDate = new Date(`${end.slice(0, 10)}T12:00:00Z`);
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / DAY_IN_MS));
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calculateRegistrationQuality(client: UniplusClient) {
  let score = 0;

  if (client.name.trim()) score += 15;
  if (client.document?.trim()) score += 15;
  if (client.phone?.trim() || client.mobile?.trim()) score += 20;
  if (client.whatsapp?.trim()) score += 20;
  if (client.email?.trim()) score += 10;
  if (client.cityId) score += 10;
  if (client.neighborhood?.trim()) score += 5;
  if (client.address?.trim()) score += 5;

  return {
    score,
    status: classifyRegistrationQuality(score),
  };
}

export function classifyRegistrationQuality(score: number): RegistrationQualityStatus {
  if (score >= 90) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 40) return "regular";
  return "ruim";
}

export function classifyCustomerActivity(daysWithoutPurchase: number): CustomerActivityStatus {
  if (daysWithoutPurchase <= 30) return "ativo";
  if (daysWithoutPurchase <= 60) return "atencao";
  if (daysWithoutPurchase <= 90) return "risco";
  return "perdido";
}

export function calculatePotentialLost(
  averageTicket: number,
  purchaseCycleDays: number,
  daysWithoutPurchase: number,
) {
  if (averageTicket <= 0 || purchaseCycleDays <= 0) return 0;
  const missedCycles = Math.floor(daysWithoutPurchase / purchaseCycleDays);
  return roundCurrency(averageTicket * missedCycles);
}

export function calculateRepurchaseScore(
  activityStatus: CustomerActivityStatus,
  registrationScore: number,
  purchaseCount: number,
) {
  const activityWeight = {
    ativo: 35,
    atencao: 65,
    risco: 85,
    perdido: 72,
  }[activityStatus];
  const historyWeight = Math.min(20, purchaseCount * 4);
  const registrationWeight = Math.round(registrationScore * 0.1);
  return Math.min(100, activityWeight + historyWeight + registrationWeight);
}

export function calculatePreferredSeller(
  clientId: number,
  sales: UniplusSale[],
  sellers: UniplusSeller[],
): SellerAffinity | undefined {
  const validSales = sales.filter(
    (sale) => sale.clientId === clientId && sale.sellerId && !sale.cancelledAt && sale.approved,
  );
  if (validSales.length === 0) return undefined;

  const grouped = new Map<number, { count: number; value: number; lastPurchaseAt: string }>();
  for (const sale of validSales) {
    const sellerId = sale.sellerId as number;
    const current = grouped.get(sellerId) ?? { count: 0, value: 0, lastPurchaseAt: sale.soldAt };
    current.count += 1;
    current.value += sale.totalValue;
    if (sale.soldAt > current.lastPurchaseAt) current.lastPurchaseAt = sale.soldAt;
    grouped.set(sellerId, current);
  }

  const [sellerId, metrics] = [...grouped.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    if (b[1].value !== a[1].value) return b[1].value - a[1].value;
    return b[1].lastPurchaseAt.localeCompare(a[1].lastPurchaseAt);
  })[0];

  const seller = sellers.find((item) => item.id === sellerId);
  return {
    sellerId,
    sellerName: seller?.name ?? "Vendedor não identificado",
    purchaseCount: metrics.count,
    totalValue: roundCurrency(metrics.value),
    lastPurchaseAt: metrics.lastPurchaseAt,
    relationshipPercentage: Math.round((metrics.count / validSales.length) * 100),
  };
}

export function resolveRepurchaseRule(
  product: UniplusProduct | undefined,
  rules: RepurchaseRule[],
  historicalAverageDays?: number,
) {
  const activeRules = rules.filter((rule) => rule.active);
  const productRule = activeRules
    .filter((rule) => rule.type === "produto" && rule.productId === product?.id)
    .sort((a, b) => b.priority - a.priority)[0];
  if (productRule) return { days: productRule.days, origin: "regra_produto" as const };

  const keywordRule = activeRules
    .filter(
      (rule) =>
        rule.type === "palavra_chave" &&
        rule.keyword &&
        product?.name.toLocaleUpperCase("pt-BR").includes(rule.keyword.toLocaleUpperCase("pt-BR")),
    )
    .sort((a, b) => b.priority - a.priority)[0];
  if (keywordRule) return { days: keywordRule.days, origin: "regra_produto" as const };

  const departmentRule = activeRules
    .filter(
      (rule) =>
        rule.type === "departamento" &&
        rule.department?.toLocaleUpperCase("pt-BR") === product?.department?.toLocaleUpperCase("pt-BR"),
    )
    .sort((a, b) => b.priority - a.priority)[0];
  if (departmentRule) return { days: departmentRule.days, origin: "regra_departamento" as const };

  if (historicalAverageDays && historicalAverageDays > 0) {
    return { days: Math.round(historicalAverageDays), origin: "historico_cliente" as const };
  }

  return undefined;
}

export function calculateProductPurchaseIntervals(
  clientId: number,
  productId: number,
  sales: UniplusSale[],
  items: UniplusSaleItem[],
) {
  const saleDates = sales
    .filter((sale) => sale.clientId === clientId && !sale.cancelledAt && sale.approved)
    .filter((sale) => items.some((item) => item.saleId === sale.id && item.productId === productId))
    .map((sale) => sale.soldAt)
    .sort();

  if (saleDates.length < 2) return undefined;

  const intervals = saleDates.slice(1).map((date, index) => daysBetween(saleDates[index], date));
  return intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function crmUuid(namespace: string, id: number | string) {
  const source = `${namespace}-${id}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  const suffix = hash.toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}
