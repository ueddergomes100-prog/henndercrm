import {
  mockRepurchaseRules,
  MOCK_REFERENCE_DATE,
  mockUniplusClients,
  mockUniplusProducts,
  mockUniplusSaleItems,
  mockUniplusSales,
  mockUniplusSellers,
} from "@/data/mock-uniplus";
import {
  addDays,
  calculatePotentialLost,
  calculatePreferredSeller,
  calculateProductPurchaseIntervals,
  calculateRegistrationQuality,
  calculateRepurchaseScore,
  classifyCustomerActivity,
  crmUuid,
  daysBetween,
  resolveCustomerWhatsApp,
  resolveRepurchaseRule,
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
  RepurchaseRule,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "@/domain/crm/types";

export class VendaService {
  getValidSourceSales() {
    const clientIds = new Set(mockUniplusClients.map((client) => client.id));
    const productIds = new Set(mockUniplusProducts.map((product) => product.id));

    return mockUniplusSales.filter((sale) => {
      const saleItems = mockUniplusSaleItems.filter((item) => item.saleId === sale.id);
      return Boolean(
        sale.clientId &&
          clientIds.has(sale.clientId) &&
          sale.clientName?.trim() &&
          !sale.cancelledAt &&
          sale.approved &&
          saleItems.length > 0 &&
          saleItems.every((item) => item.productId && productIds.has(item.productId)),
      );
    });
  }

  getSales(sourceSales = this.getValidSourceSales()): CrmSale[] {
    return sourceSales.map((sale) => ({
      id: crmUuid("sale", sale.id),
      uniplusId: sale.id,
      customerId: crmUuid("customer", sale.clientId as number),
      sellerId: sale.sellerId ? crmUuid("seller", sale.sellerId) : undefined,
      soldAt: sale.soldAt,
      totalValue: sale.totalValue,
      discountValue: sale.discountValue,
      status: sale.status,
      approved: sale.approved,
    }));
  }

  getSaleItems(sourceSales = this.getValidSourceSales()): CrmSaleItem[] {
    const validSaleIds = new Set(sourceSales.map((sale) => sale.id));
    const productMap = new Map(mockUniplusProducts.map((product) => [product.id, product]));
    return mockUniplusSaleItems
      .filter((item) => validSaleIds.has(item.saleId))
      .map((item) => {
        const product = item.productId ? productMap.get(item.productId) : undefined;
        return {
          id: crmUuid("sale-item", item.id),
          uniplusId: item.id,
          saleId: crmUuid("sale", item.saleId),
          productId: item.productId ? crmUuid("product", item.productId) : undefined,
          productCode: item.productCode ?? product?.code ?? "",
          productName: item.productName ?? product?.name ?? "Produto não identificado",
          quantity: item.quantity,
          estimatedValue: item.estimatedValue ?? roundCurrency((product?.price ?? 0) * item.quantity),
        };
      });
  }
}

export class ProdutoService {
  getProducts(rules: RepurchaseRule[] = mockRepurchaseRules): CrmProduct[] {
    return mockUniplusProducts.map((product) => {
      const rule = resolveRepurchaseRule(product, rules);
      return {
        id: crmUuid("product", product.id),
        uniplusId: product.id,
        code: product.code,
        name: product.name,
        type: product.type ?? "",
        department: product.department ?? "",
        supplier: product.supplier ?? "",
        price: product.price,
        usesCrm: product.usesCrm,
        repurchaseActive: Boolean(product.usesCrm && rule),
        defaultRepurchaseDays: rule?.days,
      };
    });
  }
}

export class QualidadeCadastroService {
  calculate(client: UniplusClient) {
    return calculateRegistrationQuality(client);
  }
}

export class ScoreClienteService {
  calculateRepurchase(
    activityStatus: CrmCustomer["activityStatus"],
    registrationScore: number,
    purchaseCount: number,
  ) {
    return calculateRepurchaseScore(activityStatus, registrationScore, purchaseCount);
  }

  calculatePotentialLost(averageTicket: number, cycleDays: number, daysWithoutPurchase: number) {
    return calculatePotentialLost(averageTicket, cycleDays, daysWithoutPurchase);
  }
}

export class ClienteService {
  constructor(
    private readonly qualityService = new QualidadeCadastroService(),
    private readonly scoreService = new ScoreClienteService(),
  ) {}

  getCustomers(
    sourceSales: UniplusSale[],
    referenceDate = MOCK_REFERENCE_DATE,
    clients = mockUniplusClients,
    sellers = mockUniplusSellers,
  ): CrmCustomer[] {
    return clients
      .map((client) => {
        const clientSales = sourceSales
          .filter((sale) => sale.clientId === client.id)
          .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
        const lastPurchaseAt = clientSales[0]?.soldAt ?? client.lastPurchaseAt ?? referenceDate;
        const daysWithoutPurchase = daysBetween(lastPurchaseAt, referenceDate);
        const totalPurchased = roundCurrency(
          clientSales.reduce((total, sale) => total + sale.totalValue, 0),
        );
        const averageTicket = clientSales.length
          ? roundCurrency(totalPurchased / clientSales.length)
          : 0;
        const registration = this.qualityService.calculate(client);
        const activityStatus = classifyCustomerActivity(daysWithoutPurchase);
        const purchaseCycleDays = client.purchaseCycleDays ?? 45;

        return {
          id: crmUuid("customer", client.id),
          uniplusId: client.id,
          code: client.code,
          name: client.name,
          legalName: client.legalName ?? "",
          document: client.document ?? "",
          phone: client.phone ?? "",
          mobile: client.mobile ?? "",
          whatsapp: resolveCustomerWhatsApp(client.mobile, client.whatsapp) ?? "",
          email: client.email ?? "",
          address: client.address ?? "",
          neighborhood: client.neighborhood ?? "",
          cityId: client.cityId,
          city: client.cityName ?? "Cidade não informada",
          stateId: client.stateId,
          zipCode: client.zipCode ?? "",
          registeredAt: client.registeredAt ?? "",
          lastPurchaseAt,
          inactive: client.inactive,
          category: client.categoryName ?? "Sem categoria",
          purchaseCycleDays,
          registrationQualityScore: registration.score,
          registrationQualityStatus: registration.status,
          activityStatus,
          daysWithoutPurchase,
          preferredSeller: calculatePreferredSeller(client.id, sourceSales, sellers),
          totalPurchases: clientSales.length,
          totalPurchased,
          averageTicket,
          repurchaseScore: this.scoreService.calculateRepurchase(
            activityStatus,
            registration.score,
            clientSales.length,
          ),
          potentialLost: this.scoreService.calculatePotentialLost(
            averageTicket,
            purchaseCycleDays,
            daysWithoutPurchase,
          ),
        };
      })
      .sort((a, b) => b.daysWithoutPurchase - a.daysWithoutPurchase);
  }
}

export class AlertaRecompraService {
  getAlerts(
    sourceSales: UniplusSale[],
    customers: CrmCustomer[],
    rules = mockRepurchaseRules,
    referenceDate = MOCK_REFERENCE_DATE,
    products = mockUniplusProducts,
    sellers = mockUniplusSellers,
    items = mockUniplusSaleItems,
  ): CrmRepurchaseAlert[] {
    const salesById = new Map(sourceSales.map((sale) => [sale.id, sale]));
    const customerByUniplusId = new Map(customers.map((customer) => [customer.uniplusId, customer]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
    const latestPurchaseByCustomerProduct = new Map<
      string,
      { sale: UniplusSale; item: UniplusSaleItem; product: UniplusProduct }
    >();

    for (const item of items) {
      const sale = salesById.get(item.saleId);
      const product = item.productId ? productById.get(item.productId) : undefined;
      if (!sale?.clientId || !product?.usesCrm) continue;
      const key = `${sale.clientId}:${product.id}`;
      const current = latestPurchaseByCustomerProduct.get(key);
      if (!current || sale.soldAt > current.sale.soldAt) {
        latestPurchaseByCustomerProduct.set(key, { sale, item, product });
      }
    }

    return [...latestPurchaseByCustomerProduct.values()]
      .flatMap(({ sale, item, product }) => {
        const customer = customerByUniplusId.get(sale.clientId as number);
        if (!customer) return [];
        const historicalAverage = calculateProductPurchaseIntervals(
          sale.clientId as number,
          product.id,
          sourceSales,
          items,
        );
        const resolvedRule = resolveRepurchaseRule(product, rules, historicalAverage);
        if (!resolvedRule) return [];

        const expectedDate = addDays(sale.soldAt, resolvedRule.days);
        const daysUntilExpected = daysBetween(referenceDate, expectedDate);
        const overdue = expectedDate < referenceDate;
        const seller = sale.sellerId ? sellerById.get(sale.sellerId) : undefined;

        return [{
          id: crmUuid("alert", item.id),
          customerId: customer.id,
          customerName: customer.name,
          productId: crmUuid("product", product.id),
          productName: product.name,
          sellerId: sale.sellerId ? crmUuid("seller", sale.sellerId) : undefined,
          sellerName: seller?.name ?? "Não atribuído",
          saleId: crmUuid("sale", sale.id),
          saleItemId: crmUuid("sale-item", item.id),
          purchaseDate: sale.soldAt,
          expectedDate,
          repurchaseDays: resolvedRule.days,
          status: "pendente" as const,
          priority: overdue || daysUntilExpected <= 3 ? ("alta" as const) : daysUntilExpected <= 10 ? ("media" as const) : ("baixa" as const),
          origin: resolvedRule.origin,
          department: product.department ?? "",
          note: historicalAverage
            ? `Intervalo médio observado: ${Math.round(historicalAverage)} dias.`
            : undefined,
        }];
      })
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  }
}

export class OportunidadeService {
  getOpportunities(
    customers: CrmCustomer[],
    products: CrmProduct[],
    sales: CrmSale[],
    items: CrmSaleItem[],
  ): CrmOpportunity[] {
    const productById = new Map(products.map((product) => [product.id, product]));
    const itemsBySale = new Map<string, CrmSaleItem[]>();
    for (const item of items) {
      const saleItems = itemsBySale.get(item.saleId) ?? [];
      saleItems.push(item);
      itemsBySale.set(item.saleId, saleItems);
    }

    const productPopularity = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) continue;
      productPopularity.set(
        item.productId,
        (productPopularity.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const rankedProducts = [...products].sort(
      (a, b) =>
        (productPopularity.get(b.id) ?? 0) - (productPopularity.get(a.id) ?? 0),
    );

    return customers
      .flatMap((customer, customerIndex) => {
        const customerSales = sales
          .filter((sale) => sale.customerId === customer.id)
          .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
        const purchasedProductIds = new Set(
          customerSales.flatMap((sale) =>
            (itemsBySale.get(sale.id) ?? []).flatMap((item) =>
              item.productId ? [item.productId] : [],
            ),
          ),
        );
        const sourceProduct = [...purchasedProductIds]
          .map((id) => productById.get(id))
          .find((product): product is CrmProduct => Boolean(product));
        if (!sourceProduct) return [];

        const suggestedProduct =
          rankedProducts.find(
            (product) =>
              !purchasedProductIds.has(product.id) &&
              product.department === sourceProduct.department,
          ) ??
          rankedProducts.find((product) => !purchasedProductIds.has(product.id));
        if (!suggestedProduct) return [];

        return [{
          id: crmUuid("opportunity", customer.uniplusId),
          customerId: customer.id,
          customerName: customer.name,
          sourceProductName: sourceProduct.name,
          suggestedProductName: suggestedProduct.name,
          reason: `Sugestão demonstrativa baseada em produtos relacionados do departamento ${suggestedProduct.department || "comercial"}.`,
          confidence: Math.min(94, 72 + (customerIndex % 6) * 4),
          status: "aberta" as const,
          sellerId: customer.preferredSeller
            ? crmUuid("seller", customer.preferredSeller.sellerId)
            : undefined,
          sellerName: customer.preferredSeller?.sellerName ?? "Não atribuído",
        }];
      })
      .slice(0, 12);
  }
}

export class AgendaService {
  getAgenda(alerts: CrmRepurchaseAlert[], customers: CrmCustomer[]): CrmAgendaEvent[] {
    const alertEvents = alerts.slice(0, 4).map((alert, index) => ({
      id: crmUuid("agenda-alert", alert.id),
      date: alert.expectedDate < MOCK_REFERENCE_DATE ? MOCK_REFERENCE_DATE : alert.expectedDate,
      time: ["08:30", "10:00", "13:30", "16:00"][index],
      title: `Recompra: ${alert.customerName}`,
      type: "Recompra" as const,
      customerId: alert.customerId,
      sellerId: alert.sellerId,
    }));
    const riskCustomer = customers.find((customer) => customer.activityStatus === "perdido");

    return [
      ...alertEvents,
      ...(riskCustomer
        ? [{
            id: crmUuid("agenda-risk", riskCustomer.id),
            date: MOCK_REFERENCE_DATE,
            time: "14:30",
            title: `Retorno: ${riskCustomer.name}`,
            type: "Retorno" as const,
            customerId: riskCustomer.id,
          }]
        : []),
    ].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }
}

export class VendedorService {
  getSellers(
    sourceSellers: UniplusSeller[],
    customers: CrmCustomer[],
    alerts: CrmRepurchaseAlert[],
  ): CrmSeller[] {
    return sourceSellers
      .filter((seller) => !seller.inactive)
      .map((seller) => {
        const assignedCustomers = customers.filter(
          (customer) => customer.preferredSeller?.sellerId === seller.id,
        );
        const sellerAlerts = alerts.filter(
          (alert) => alert.sellerId === crmUuid("seller", seller.id),
        );
        return {
          id: crmUuid("seller", seller.id),
          uniplusId: seller.id,
          name: seller.name,
          email: seller.email ?? "",
          mobile: seller.mobile ?? "",
          whatsapp: seller.whatsapp ?? "",
          supervisor: seller.supervisor,
          inactive: seller.inactive,
          customerCount: assignedCustomers.length,
          riskCustomerCount: assignedCustomers.filter(
            (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
          ).length,
          openAlertCount: sellerAlerts.length,
          potentialValue: roundCurrency(
            assignedCustomers.reduce((total, customer) => total + customer.potentialLost, 0),
          ),
          conversionRate: Math.min(96, 58 + assignedCustomers.length * 7),
        };
      })
      .sort((a, b) => b.potentialValue - a.potentialValue);
  }
}

export class RelatorioService {
  getDashboard(
    customers: CrmCustomer[],
    alerts: CrmRepurchaseAlert[],
    referenceDate = MOCK_REFERENCE_DATE,
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
      averageRegistrationQuality: customers.length
        ? Math.round(qualityTotal / customers.length)
        : 0,
    };
  }
}
