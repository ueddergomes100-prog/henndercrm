import "server-only";

import { crmDemoService } from "@/services/crm-demo-service";
import {
  MockUniplusClientRepository,
  MockUniplusProductRepository,
  MockUniplusSaleRepository,
  MockUniplusSellerRepository,
} from "@/integrations/uniplus/mock-repositories";
import { SupabaseCrmSyncRepository } from "@/infrastructure/supabase/supabase-crm-sync-repository";
import { SupabaseRestClient } from "@/infrastructure/supabase/supabase-rest-client";
import { UniplusSyncService } from "./uniplus-sync-service";

type ExternalRow = { id: string; uniplus_id: number };

export class CrmSupabaseBootstrapService {
  constructor(private readonly client = new SupabaseRestClient()) {}

  async run() {
    const sync = new UniplusSyncService(
      new MockUniplusClientRepository(),
      new MockUniplusProductRepository(),
      new MockUniplusSaleRepository(),
      new MockUniplusSellerRepository(),
      new SupabaseCrmSyncRepository(this.client),
    );
    const syncResult = await sync.synchronize();
    const snapshot = crmDemoService.getSnapshot();

    const [clients, sellers, products, sales, items] = await Promise.all([
      this.client.select<ExternalRow>("crm_clientes", {
        select: "id,uniplus_id",
      }),
      this.client.select<ExternalRow>("crm_vendedores", {
        select: "id,uniplus_id",
      }),
      this.client.select<ExternalRow>("crm_produtos", {
        select: "id,uniplus_id",
      }),
      this.client.select<ExternalRow>("crm_vendas", {
        select: "id,uniplus_id",
      }),
      this.client.select<ExternalRow>("crm_itens_venda", {
        select: "id,uniplus_id",
      }),
    ]);

    const clientByExternal = new Map(
      clients.map((row) => [row.uniplus_id, row.id]),
    );
    const sellerByExternal = new Map(
      sellers.map((row) => [row.uniplus_id, row.id]),
    );
    const productByExternal = new Map(
      products.map((row) => [row.uniplus_id, row.id]),
    );
    const saleByExternal = new Map(
      sales.map((row) => [row.uniplus_id, row.id]),
    );
    const itemByExternal = new Map(
      items.map((row) => [row.uniplus_id, row.id]),
    );
    const customerByDomain = new Map(
      snapshot.customers.map((customer) => [customer.id, customer]),
    );
    const sellerByDomain = new Map(
      snapshot.sellers.map((seller) => [seller.id, seller]),
    );
    const productByDomain = new Map(
      snapshot.products.map((product) => [product.id, product]),
    );
    const saleByDomain = new Map(
      snapshot.sales.map((sale) => [sale.id, sale]),
    );
    const itemByDomain = new Map(
      snapshot.saleItems.map((item) => [item.id, item]),
    );

    await this.client.upsert(
      "crm_alertas_recompra",
      snapshot.alerts.map((alert) => {
        const customer = customerByDomain.get(alert.customerId);
        const product = alert.productId
          ? productByDomain.get(alert.productId)
          : undefined;
        const seller = alert.sellerId
          ? sellerByDomain.get(alert.sellerId)
          : undefined;
        const sale = saleByDomain.get(alert.saleId);
        const item = itemByDomain.get(alert.saleItemId);
        if (!customer || !product || !sale || !item) {
          throw new Error(`Relacionamento incompleto no alerta ${alert.id}.`);
        }
        return {
          id: alert.id,
          cliente_id: clientByExternal.get(customer.uniplusId),
          produto_id: productByExternal.get(product.uniplusId),
          venda_id: saleByExternal.get(sale.uniplusId),
          item_venda_id: itemByExternal.get(item.uniplusId),
          vendedor_responsavel_id: seller
            ? sellerByExternal.get(seller.uniplusId)
            : null,
          data_compra: alert.purchaseDate,
          data_prevista_recompra: alert.expectedDate,
          dias_recompra: alert.repurchaseDays,
          status: alert.status,
          prioridade: alert.priority,
          origem: alert.origin,
          observacao: alert.note ?? null,
        };
      }),
      "id",
    );

    await this.client.upsert(
      "crm_oportunidades",
      snapshot.opportunities.map((opportunity) => {
        const customer = customerByDomain.get(opportunity.customerId);
        const seller = opportunity.sellerId
          ? sellerByDomain.get(opportunity.sellerId)
          : undefined;
        const sourceProduct = snapshot.products.find(
          (product) => product.name === opportunity.sourceProductName,
        );
        if (!customer) {
          throw new Error(
            `Cliente da oportunidade ${opportunity.id} não encontrado.`,
          );
        }
        return {
          id: opportunity.id,
          cliente_id: clientByExternal.get(customer.uniplusId),
          produto_origem_id: sourceProduct
            ? productByExternal.get(sourceProduct.uniplusId)
            : null,
          produto_sugerido_nome: opportunity.suggestedProductName,
          motivo: opportunity.reason,
          confianca: opportunity.confidence,
          status: opportunity.status,
          vendedor_responsavel_id: seller
            ? sellerByExternal.get(seller.uniplusId)
            : null,
        };
      }),
      "id",
    );

    await this.client.upsert(
      "crm_agenda_eventos",
      snapshot.agenda.map((event) => {
        const customer = event.customerId
          ? customerByDomain.get(event.customerId)
          : undefined;
        const seller = event.sellerId
          ? sellerByDomain.get(event.sellerId)
          : undefined;
        return {
          id: event.id,
          titulo: event.title,
          tipo: event.type,
          data_evento: event.date,
          hora_evento: event.time,
          cliente_id: customer
            ? clientByExternal.get(customer.uniplusId)
            : null,
          vendedor_id: seller
            ? sellerByExternal.get(seller.uniplusId)
            : null,
        };
      }),
      "id",
    );

    return {
      sync: syncResult,
      operational: {
        alerts: snapshot.alerts.length,
        opportunities: snapshot.opportunities.length,
        agenda: snapshot.agenda.length,
      },
    };
  }
}

export const crmSupabaseBootstrapService =
  new CrmSupabaseBootstrapService();
