import {
  InMemoryCrmSyncTargetRepository,
  MockUniplusClientRepository,
  MockUniplusProductRepository,
  MockUniplusSaleRepository,
  MockUniplusSellerRepository,
} from "@/integrations/uniplus/mock-repositories";
import { UniplusSyncService } from "@/services/uniplus-sync-service";

export async function POST() {
  const target = new InMemoryCrmSyncTargetRepository();
  const service = new UniplusSyncService(
    new MockUniplusClientRepository(),
    new MockUniplusProductRepository(),
    new MockUniplusSaleRepository(),
    new MockUniplusSellerRepository(),
    target,
  );

  const result = await service.synchronize();
  return Response.json({
    ...result,
    importedEntities: {
      clients: target.clients.length,
      sellers: target.sellers.length,
      products: target.products.length,
      sales: target.sales.length,
      items: target.items.length,
    },
  });
}
