import { cookies } from "next/headers";
import type { CrmCustomer, CrmDashboard, CrmSessionUser, CrmSnapshot } from "@/domain/crm/types";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import { getCachedCrmSnapshot } from "@/lib/crm-snapshot-cache";

export async function GET() {
  try {
    const user = await requireUser();
    if (user instanceof Response) return user;
    const snapshot = await getCachedCrmSnapshot();
    return Response.json(scopeSnapshotForUser(snapshot, user));
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
