import type {
  IgnoredSale,
  SyncResult,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "@/domain/crm/types";

export interface IUniplusClientRepository {
  listUpdatedSince(lastSync?: string): Promise<UniplusClient[]>;
  findById(id: number): Promise<UniplusClient | undefined>;
}

export interface IUniplusProductRepository {
  listUpdatedSince(lastSync?: string): Promise<UniplusProduct[]>;
  findById(id: number): Promise<UniplusProduct | undefined>;
}

export interface IUniplusSaleRepository {
  listUpdatedSince(lastSync?: string): Promise<UniplusSale[]>;
  listItemsBySaleIds(saleIds: number[]): Promise<UniplusSaleItem[]>;
}

export interface IUniplusSellerRepository {
  listUpdatedSince(lastSync?: string): Promise<UniplusSeller[]>;
  findById(id: number): Promise<UniplusSeller | undefined>;
}

export interface ICrmSyncTargetRepository {
  beginSync(origin: string): Promise<string>;
  upsertClients(clients: UniplusClient[]): Promise<void>;
  upsertProducts(products: UniplusProduct[]): Promise<void>;
  upsertSellers(sellers: UniplusSeller[]): Promise<void>;
  upsertSales(sales: UniplusSale[], items: UniplusSaleItem[]): Promise<void>;
  saveIgnoredSales(ignoredSales: IgnoredSale[]): Promise<void>;
  finishSync(syncId: string, result: SyncResult): Promise<void>;
}
