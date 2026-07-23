import type {
  CrmSale,
  CrmSeller,
} from "@/domain/crm/types";
import type { CustomerViewModel } from "@/services/crm-view-service";
import type {
  AttendanceEvaluation,
  AttendanceEvaluationFilters,
  SellerEvaluationPerformance,
} from "./types";

type DateRange = {
  from: Date;
  to: Date;
};

export function getEvaluationDateRange(
  filters: AttendanceEvaluationFilters,
  referenceDate: string,
): DateRange {
  const reference = startOfDay(parseDate(referenceDate));
  let from = reference;
  let to = endOfDay(reference);

  if (filters.period === "ontem") {
    from = addDays(reference, -1);
    to = endOfDay(from);
  } else if (filters.period === "7_dias") {
    from = addDays(reference, -6);
  } else if (filters.period === "30_dias") {
    from = addDays(reference, -29);
  } else if (filters.period === "90_dias") {
    from = addDays(reference, -89);
  } else if (filters.period === "mes_atual") {
    from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  } else if (filters.period === "mes_anterior") {
    from = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
    to = endOfDay(new Date(reference.getFullYear(), reference.getMonth(), 0));
  } else if (filters.period === "ano") {
    from = new Date(reference.getFullYear(), 0, 1);
  } else if (filters.period === "personalizado") {
    from = filters.from ? startOfDay(parseDate(filters.from)) : reference;
    to = filters.to ? endOfDay(parseDate(filters.to)) : endOfDay(reference);
  }

  return { from: startOfDay(from), to: endOfDay(to) };
}

export function filterCommercialSales(
  sales: CrmSale[],
  filters: AttendanceEvaluationFilters,
  referenceDate: string,
  customersById?: Map<string, CustomerViewModel>,
) {
  const range = getEvaluationDateRange(filters, referenceDate);
  const customerQuery = normalizeText(filters.customerQuery);
  const cityQuery = normalizeText(filters.cityQuery);
  return sales.filter((sale) => {
    const soldAt = parseDate(sale.soldAt);
    const customer = customersById?.get(sale.customerId);
    return (
      soldAt >= range.from &&
      soldAt <= range.to &&
      (filters.sellerId === "todos" || sale.sellerId === filters.sellerId) &&
      (!customerQuery ||
        normalizeText(customer?.name ?? "").includes(customerQuery)) &&
      (!cityQuery || normalizeText(customer?.city ?? "").includes(cityQuery))
    );
  });
}

export function filterAttendanceEvaluations(
  evaluations: AttendanceEvaluation[],
  filters: AttendanceEvaluationFilters,
  referenceDate: string,
  customersById: Map<string, CustomerViewModel>,
) {
  const range = getEvaluationDateRange(filters, referenceDate);
  const customerQuery = normalizeText(filters.customerQuery);
  const cityQuery = normalizeText(filters.cityQuery);
  const rating = Number(filters.rating);

  return evaluations.filter((evaluation) => {
    const createdAt = parseDate(evaluation.createdAt);
    const customer = customersById.get(evaluation.customerId);
    return (
      createdAt >= range.from &&
      createdAt <= range.to &&
      (filters.sellerId === "todos" || evaluation.sellerId === filters.sellerId) &&
      (!customerQuery ||
        normalizeText(evaluation.customerName).includes(customerQuery)) &&
      (!cityQuery || normalizeText(customer?.city ?? "").includes(cityQuery)) &&
      (!filters.rating || Math.round(evaluation.rating) === rating)
    );
  });
}

export function buildSellerEvaluationPerformance({
  sellers,
  sales,
  evaluations,
}: {
  sellers: CrmSeller[];
  sales: CrmSale[];
  evaluations: AttendanceEvaluation[];
}): SellerEvaluationPerformance[] {
  const rows = sellers
    .filter((seller) => !seller.inactive)
    .map((seller) => {
      const sellerSales = sales.filter((sale) => sale.sellerId === seller.id);
      const sellerEvaluations = evaluations.filter(
        (evaluation) => evaluation.sellerId === seller.id,
      );
      const customerSales = new Map<string, number>();
      for (const sale of sellerSales) {
        customerSales.set(sale.customerId, (customerSales.get(sale.customerId) ?? 0) + 1);
      }
      const recurringCustomers = [...customerSales.values()].filter(
        (count) => count > 1,
      ).length;
      const revenue = sum(sellerSales.map((sale) => sale.totalValue));
      const rating = sellerEvaluations.length
        ? average(sellerEvaluations.map((evaluation) => evaluation.rating))
        : null;
      const serviceDurations = sellerEvaluations
        .map((evaluation) => evaluation.serviceDurationMinutes)
        .filter((value): value is number => typeof value === "number");

      return {
        sellerId: seller.id,
        sellerName: seller.name,
        initials: getInitials(seller.name),
        role: seller.supervisor ? "Supervisor" : "Vendedor",
        department: "Comercial",
        rating,
        reviewCount: sellerEvaluations.length,
        salesCount: sellerSales.length,
        revenue,
        averageTicket: sellerSales.length ? revenue / sellerSales.length : 0,
        customerCount: customerSales.size,
        repeatPurchaseRate: customerSales.size
          ? (recurringCustomers / customerSales.size) * 100
          : 0,
        lastSaleAt: getLatestDate(sellerSales.map((sale) => sale.soldAt)),
        lastReviewAt: getLatestDate(
          sellerEvaluations.map((evaluation) => evaluation.createdAt),
        ),
        averageServiceMinutes: serviceDurations.length
          ? average(serviceDurations)
          : null,
        rankingPosition: 0,
        badge: getPerformanceBadge(rating, false),
      } satisfies SellerEvaluationPerformance;
    })
    .sort((left, right) => {
      if (left.rating !== null || right.rating !== null) {
        if (left.rating === null) return 1;
        if (right.rating === null) return -1;
        if (right.rating !== left.rating) return right.rating - left.rating;
        if (right.reviewCount !== left.reviewCount) {
          return right.reviewCount - left.reviewCount;
        }
      }
      if (right.revenue !== left.revenue) return right.revenue - left.revenue;
      return left.sellerName.localeCompare(right.sellerName, "pt-BR");
    });

  return rows.map((row, index) => ({
    ...row,
    rankingPosition: index + 1,
    badge: getPerformanceBadge(row.rating, index === 0 && row.rating !== null),
  }));
}

export function buildMonthlyEvaluationSeries(
  evaluations: AttendanceEvaluation[],
  referenceDate: string,
) {
  const reference = parseDate(referenceDate);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - (11 - index), 1);
    const monthEvaluations = evaluations.filter((evaluation) => {
      const createdAt = parseDate(evaluation.createdAt);
      return (
        createdAt.getFullYear() === date.getFullYear() &&
        createdAt.getMonth() === date.getMonth()
      );
    });
    return {
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(date)
        .replace(".", ""),
      rating: monthEvaluations.length
        ? Number(
            average(monthEvaluations.map((evaluation) => evaluation.rating)).toFixed(2),
          )
        : null,
      reviews: monthEvaluations.length,
    };
  });
}

export function buildRatingDistribution(evaluations: AttendanceEvaluation[]) {
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = evaluations.filter(
      (evaluation) => Math.round(evaluation.rating) === rating,
    ).length;
    return {
      rating,
      count,
      percentage: evaluations.length ? (count / evaluations.length) * 100 : 0,
    };
  });
}

export function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

export function formatCompactDate(value: string | null) {
  if (!value) return "Sem registro";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getPerformanceBadge(
  rating: number | null,
  topPerformer: boolean,
): SellerEvaluationPerformance["badge"] {
  if (rating === null) return "Aguardando avaliações";
  if (topPerformer && rating >= 4.8) return "Top Performer";
  if (rating >= 4.8) return "Excelente";
  if (rating >= 4.5) return "Muito Bom";
  if (rating >= 4) return "Bom";
  if (rating >= 3) return "Regular";
  return "Necessita Atenção";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "VA";
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function getLatestDate(values: string[]) {
  if (!values.length) return null;
  return values.reduce((latest, current) =>
    parseDate(current) > parseDate(latest) ? current : latest,
  );
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
