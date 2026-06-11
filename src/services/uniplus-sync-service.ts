import type { IgnoredSale, SyncResult, UniplusSale } from "@/domain/crm/types";
import type {
  ICrmSyncTargetRepository,
  IUniplusClientRepository,
  IUniplusProductRepository,
  IUniplusSaleRepository,
  IUniplusSellerRepository,
} from "@/integrations/uniplus/repositories";

export class UniplusSyncService {
  constructor(
    private readonly clients: IUniplusClientRepository,
    private readonly products: IUniplusProductRepository,
    private readonly sales: IUniplusSaleRepository,
    private readonly sellers: IUniplusSellerRepository,
    private readonly target: ICrmSyncTargetRepository,
  ) {}

  async synchronize(lastSync?: string): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const syncId = await this.target.beginSync("uniplus");

    const [clients, products, sellers, sales] = await Promise.all([
      this.clients.listUpdatedSince(lastSync),
      this.products.listUpdatedSince(lastSync),
      this.sellers.listUpdatedSince(lastSync),
      this.sales.listUpdatedSince(lastSync),
    ]);
    const items = await this.sales.listItemsBySaleIds(sales.map((sale) => sale.id));

    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const productMap = new Map(products.map((product) => [product.id, product]));
    const itemsBySale = new Map<number, typeof items>();
    for (const item of items) {
      const saleItems = itemsBySale.get(item.saleId) ?? [];
      saleItems.push(item);
      itemsBySale.set(item.saleId, saleItems);
    }
    const ignoredSales: IgnoredSale[] = [];
    const validSales: UniplusSale[] = [];

    for (const sale of sales) {
      const reason = getIgnoredReason(sale, itemsBySale.get(sale.id) ?? [], clientMap, productMap);
      if (reason) {
        ignoredSales.push({ saleId: sale.id, reason, data: sale });
      } else {
        validSales.push(sale);
      }
    }

    const validSaleIds = new Set(validSales.map((sale) => sale.id));
    const validItems = items.filter((item) => validSaleIds.has(item.saleId));
    const usedClientIds = new Set(validSales.map((sale) => sale.clientId as number));
    const usedProductIds = new Set(validItems.map((item) => item.productId as number));
    const usedSellerIds = new Set(validSales.flatMap((sale) => (sale.sellerId ? [sale.sellerId] : [])));

    await this.target.upsertClients(clients.filter((client) => usedClientIds.has(client.id)));
    await this.target.upsertProducts(products.filter((product) => usedProductIds.has(product.id)));
    await this.target.upsertSellers(sellers.filter((seller) => usedSellerIds.has(seller.id)));
    await this.target.upsertSales(validSales, validItems);
    await this.target.saveIgnoredSales(ignoredSales);

    const result: SyncResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      totalRead: sales.length,
      totalImported: validSales.length,
      totalIgnored: ignoredSales.length,
      ignoredSales,
    };
    await this.target.finishSync(syncId, result);
    return result;
  }
}

function getIgnoredReason(
  sale: UniplusSale,
  items: Array<{ productId?: number; productName?: string }>,
  clients: Map<number, { inactive: boolean }>,
  products: Map<number, unknown>,
): IgnoredSale["reason"] | undefined {
  if (!sale.clientId || !sale.clientName?.trim()) return "cliente_nao_identificado";
  if (sale.cancelledAt || sale.status.toLocaleUpperCase("pt-BR").includes("CANCEL")) return "venda_cancelada";

  const client = clients.get(sale.clientId);
  if (!client) return "dados_incompletos";
  if (client.inactive) return "cliente_inativo";
  if (items.length === 0) return "dados_incompletos";
  if (items.some((item) => !item.productId || !item.productName?.trim() || !products.has(item.productId))) {
    return "item_sem_produto";
  }
  return undefined;
}
