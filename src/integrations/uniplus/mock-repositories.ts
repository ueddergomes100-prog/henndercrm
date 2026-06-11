import {
  mockUniplusClients,
  mockUniplusProducts,
  mockUniplusSaleItems,
  mockUniplusSales,
  mockUniplusSellers,
} from "@/data/mock-uniplus";
import type {
  IgnoredSale,
  SyncResult,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "@/domain/crm/types";
import type {
  ICrmSyncTargetRepository,
  IUniplusClientRepository,
  IUniplusProductRepository,
  IUniplusSaleRepository,
  IUniplusSellerRepository,
} from "./repositories";

export class MockUniplusClientRepository implements IUniplusClientRepository {
  async listUpdatedSince() {
    return structuredClone(mockUniplusClients);
  }

  async findById(id: number) {
    return structuredClone(mockUniplusClients.find((client) => client.id === id));
  }
}

export class MockUniplusProductRepository implements IUniplusProductRepository {
  async listUpdatedSince() {
    return structuredClone(mockUniplusProducts);
  }

  async findById(id: number) {
    return structuredClone(mockUniplusProducts.find((product) => product.id === id));
  }
}

export class MockUniplusSaleRepository implements IUniplusSaleRepository {
  async listUpdatedSince(lastSync?: string) {
    return structuredClone(
      lastSync
        ? mockUniplusSales.filter(
            (sale) => sale.changedAt >= lastSync || sale.includedAt >= lastSync || sale.soldAt >= lastSync,
          )
        : mockUniplusSales,
    );
  }

  async listItemsBySaleIds(saleIds: number[]) {
    const saleIdSet = new Set(saleIds);
    return structuredClone(mockUniplusSaleItems.filter((item) => saleIdSet.has(item.saleId)));
  }
}

export class MockUniplusSellerRepository implements IUniplusSellerRepository {
  async listUpdatedSince() {
    return structuredClone(mockUniplusSellers);
  }

  async findById(id: number) {
    return structuredClone(mockUniplusSellers.find((seller) => seller.id === id));
  }
}

export class InMemoryCrmSyncTargetRepository implements ICrmSyncTargetRepository {
  clients: UniplusClient[] = [];
  products: UniplusProduct[] = [];
  sellers: UniplusSeller[] = [];
  sales: UniplusSale[] = [];
  items: UniplusSaleItem[] = [];
  ignoredSales: IgnoredSale[] = [];
  syncRuns: Array<{ id: string; result?: SyncResult }> = [];

  async beginSync() {
    const id = `mock-sync-${this.syncRuns.length + 1}`;
    this.syncRuns.push({ id });
    return id;
  }

  async upsertClients(clients: UniplusClient[]) {
    this.clients = upsertById(this.clients, clients);
  }

  async upsertProducts(products: UniplusProduct[]) {
    this.products = upsertById(this.products, products);
  }

  async upsertSellers(sellers: UniplusSeller[]) {
    this.sellers = upsertById(this.sellers, sellers);
  }

  async upsertSales(sales: UniplusSale[], items: UniplusSaleItem[]) {
    this.sales = upsertById(this.sales, sales);
    this.items = upsertById(this.items, items);
  }

  async saveIgnoredSales(ignoredSales: IgnoredSale[]) {
    this.ignoredSales.push(...structuredClone(ignoredSales));
  }

  async finishSync(syncId: string, result: SyncResult) {
    const syncRun = this.syncRuns.find((run) => run.id === syncId);
    if (syncRun) syncRun.result = structuredClone(result);
  }
}

function upsertById<T extends { id: number }>(current: T[], incoming: T[]) {
  const values = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) values.set(item.id, structuredClone(item));
  return [...values.values()];
}
