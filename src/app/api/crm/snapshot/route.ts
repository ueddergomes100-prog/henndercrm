import { cookies } from "next/headers";
import type {
  CrmCustomer,
  CrmDashboard,
  CrmDashboardInsights,
  CrmSessionUser,
  CrmSnapshot,
} from "@/domain/crm/types";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import {
  getCachedCrmDashboardSnapshot,
  getCachedCrmSnapshot,
  invalidateCrmSnapshotCache,
} from "@/lib/crm-snapshot-cache";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (user instanceof Response) return user;
    if (new URL(request.url).searchParams.get("refresh") === "1") {
      invalidateCrmSnapshotCache();
    }
    const dashboardOnly = new URL(request.url).searchParams.get("mode") === "dashboard";
    const snapshot = dashboardOnly
      ? await getCachedCrmDashboardSnapshot()
      : await getCachedCrmSnapshot();
    const scopedSnapshot = scopeSnapshotForUser(snapshot, user);
    return Response.json(
      dashboardOnly ? createDashboardResponse(scopedSnapshot) : scopedSnapshot,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar snapshot do Supabase.",
      },
      { status: 500 },
    );
  }
}

function createDashboardResponse(snapshot: CrmSnapshot): CrmSnapshot {
  return {
    ...snapshot,
    sales: [],
    saleItems: [],
    opportunities: [],
    dashboardInsights: buildDashboardInsights(snapshot),
  };
}

function buildDashboardInsights(snapshot: CrmSnapshot): CrmDashboardInsights {
  const months = [
    ["01", "Jan"],
    ["02", "Fev"],
    ["03", "Mar"],
    ["04", "Abr"],
    ["05", "Mai"],
    ["06", "Jun"],
  ] as const;
  const saleCountByCustomer = new Map<string, number>();
  for (const sale of snapshot.sales) {
    saleCountByCustomer.set(
      sale.customerId,
      (saleCountByCustomer.get(sale.customerId) ?? 0) + 1,
    );
  }
  const repurchaseTrend = months.map(([month, label]) => {
    const monthSales = snapshot.sales.filter((sale) => sale.soldAt.slice(5, 7) === month);
    const recurringCustomers = new Set(
      monthSales
        .map((sale) => sale.customerId)
        .filter((customerId) => (saleCountByCustomer.get(customerId) ?? 0) > 1),
    );
    return {
      mes: label,
      recompra: monthSales.length,
      recuperados: recurringCustomers.size,
    };
  });
  const productsById = new Map(snapshot.products.map((product) => [product.id, product]));
  const categoryTotals = new Map<string, number>();

  for (const item of snapshot.saleItems) {
    const department = item.productId
      ? productsById.get(item.productId)?.department || "Outros"
      : "Outros";
    categoryTotals.set(
      department,
      (categoryTotals.get(department) ?? 0) + item.estimatedValue,
    );
  }

  const colors = ["#16a34a", "#0f766e", "#f59e0b", "#2563eb"];
  const grandTotal = [...categoryTotals.values()].reduce((total, value) => total + value, 0) || 1;
  const categoryData = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([name, value], index) => ({
      name,
      value: Math.round((value / grandTotal) * 100),
      color: colors[index],
    }));

  return { repurchaseTrend, categoryData };
}

async function requireUser(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  return user ?? Response.json({ error: "Sessao expirada." }, { status: 401 });
}

function scopeSnapshotForUser(snapshot: CrmSnapshot, user: CrmSessionUser): CrmSnapshot {
  if (user.role === "administrador") return snapshot;

  const seller = resolveSnapshotSeller(user.sellerId, snapshot);
  if (!seller) {
    return {
      ...snapshot,
      dashboard: createScopedDashboard([], [], snapshot.referenceDate),
      customers: [],
      sellers: [],
      products: [],
      sales: [],
      saleItems: [],
      alerts: [],
      opportunities: [],
      agenda: [],
    };
  }

  const customerIds = getSellerCustomerIds(seller.id, snapshot);
  const sales = snapshot.sales.filter((sale) => sale.sellerId === seller.id);
  const saleIds = new Set(sales.map((sale) => sale.id));
  const saleCustomerIds = new Set(sales.map((sale) => sale.customerId));
  const alerts = snapshot.alerts.filter(
    (alert) => alert.sellerId === seller.id || saleCustomerIds.has(alert.customerId),
  );
  for (const alert of alerts) customerIds.add(alert.customerId);
  const opportunities = snapshot.opportunities.filter(
    (opportunity) => opportunity.sellerId === seller.id || customerIds.has(opportunity.customerId),
  );
  for (const opportunity of opportunities) customerIds.add(opportunity.customerId);
  const customers = snapshot.customers.filter((customer) => customerIds.has(customer.id));
  const saleItems = snapshot.saleItems.filter((item) => saleIds.has(item.saleId));
  const productIds = new Set(saleItems.flatMap((item) => (item.productId ? [item.productId] : [])));
  const alertProductIds = new Set(alerts.flatMap((alert) => (alert.productId ? [alert.productId] : [])));
  const products = snapshot.products.filter(
    (product) => productIds.has(product.id) || alertProductIds.has(product.id),
  );
  const scopedCustomerIds = new Set(customers.map((customer) => customer.id));

  return {
    ...snapshot,
    dashboard: createScopedDashboard(customers, alerts, snapshot.referenceDate),
    customers,
    sellers: [seller],
    products,
    sales,
    saleItems,
    alerts: alerts.filter((alert) => scopedCustomerIds.has(alert.customerId)),
    opportunities: opportunities.filter((opportunity) => scopedCustomerIds.has(opportunity.customerId)),
    agenda: snapshot.agenda.filter(
      (event) => event.sellerId === seller.id || (event.customerId ? scopedCustomerIds.has(event.customerId) : false),
    ),
  };
}

function resolveSnapshotSeller(sellerId: string | undefined, snapshot: CrmSnapshot) {
  if (!sellerId) return undefined;
  const exactSeller = snapshot.sellers.find((seller) => seller.id === sellerId);
  if (exactSeller) return exactSeller;
  if (!snapshot.sellers.length) return undefined;

  const hash = [...sellerId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return snapshot.sellers[hash % snapshot.sellers.length];
}

function getSellerCustomerIds(sellerId: string, snapshot: CrmSnapshot) {
  const seller = snapshot.sellers.find((item) => item.id === sellerId);
  const customerIds = new Set<string>();

  for (const customer of snapshot.customers) {
    if (customer.preferredSeller?.sellerId === seller?.uniplusId) customerIds.add(customer.id);
  }

  for (const sale of snapshot.sales) {
    if (sale.sellerId === sellerId) customerIds.add(sale.customerId);
  }

  for (const alert of snapshot.alerts) {
    if (alert.sellerId === sellerId) customerIds.add(alert.customerId);
  }

  return customerIds;
}

function createScopedDashboard(
  customers: CrmCustomer[],
  alerts: CrmSnapshot["alerts"],
  referenceDate: string,
): CrmDashboard {
  const qualityTotal = customers.reduce((total, customer) => total + customer.registrationQualityScore, 0);
  return {
    activeCustomers: customers.filter((customer) => customer.activityStatus === "ativo").length,
    attentionCustomers: customers.filter((customer) => customer.activityStatus === "atencao").length,
    riskCustomers: customers.filter((customer) => customer.activityStatus === "risco").length,
    lostCustomers: customers.filter((customer) => customer.activityStatus === "perdido").length,
    alertsToday: alerts.filter((alert) => alert.status === "pendente" && alert.expectedDate === referenceDate).length,
    recoverableRevenue: customers.reduce((total, customer) => total + customer.potentialLost, 0),
    potentialLost: customers.reduce((total, customer) => total + customer.potentialLost, 0),
    averageRegistrationQuality: customers.length ? Math.round(qualityTotal / customers.length) : 0,
  };
}
