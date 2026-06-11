import "server-only";

import {
  calculateRegistrationQuality,
  roundCurrency,
} from "@/domain/crm/rules";
import type {
  IgnoredSale,
  SyncResult,
  UniplusClient,
  UniplusProduct,
  UniplusSale,
  UniplusSaleItem,
  UniplusSeller,
} from "@/domain/crm/types";
import type { ICrmSyncTargetRepository } from "@/integrations/uniplus/repositories";
import { SupabaseRestClient } from "./supabase-rest-client";

type ExternalIdRow = { id: string; uniplus_id: number };
type ProductExternalIdRow = ExternalIdRow & { preco: number | null };

export class SupabaseCrmSyncRepository implements ICrmSyncTargetRepository {
  constructor(private readonly client = new SupabaseRestClient()) {}

  async beginSync(origin: string) {
    const [run] = await this.client.insert<{ id: string }>("crm_sincronizacoes", [{
      origem: origin,
      status: "iniciada",
      inicio: new Date().toISOString(),
    }]);
    return run.id;
  }

  async upsertClients(clients: UniplusClient[]) {
    if (clients.length === 0) return;
    await this.client.upsert("crm_clientes", clients.map(mapClient), "uniplus_id");
  }

  async upsertProducts(products: UniplusProduct[]) {
    if (products.length === 0) return;
    await this.client.upsert("crm_produtos", products.map(mapProduct), "uniplus_id");
  }

  async upsertSellers(sellers: UniplusSeller[]) {
    if (sellers.length === 0) return;
    await this.client.upsert("crm_vendedores", sellers.map(mapSeller), "uniplus_id");
  }

  async upsertSales(sales: UniplusSale[], items: UniplusSaleItem[]) {
    if (sales.length === 0) return;

    const [clients, sellers, products] = await Promise.all([
      this.client.select<ExternalIdRow>("crm_clientes", { select: "id,uniplus_id" }),
      this.client.select<ExternalIdRow>("crm_vendedores", { select: "id,uniplus_id" }),
      this.client.select<ProductExternalIdRow>("crm_produtos", { select: "id,uniplus_id,preco" }),
    ]);
    const clientIds = new Map(clients.map((row) => [row.uniplus_id, row.id]));
    const sellerIds = new Map(sellers.map((row) => [row.uniplus_id, row.id]));
    const productIds = new Map(products.map((row) => [row.uniplus_id, row.id]));
    const productPrices = new Map(products.map((row) => [row.uniplus_id, row.preco ?? 0]));

    await this.client.upsert(
      "crm_vendas",
      sales.map((sale) => ({
        uniplus_id: sale.id,
        cliente_id: clientIds.get(sale.clientId as number),
        vendedor_id: sale.sellerId
          ? sellerIds.get(sale.sellerId) ?? null
          : null,
        data_venda: sale.soldAt,
        data_inclusao: sale.includedAt,
        data_alteracao: sale.changedAt,
        valor_total: sale.totalValue,
        valor_desconto: sale.discountValue,
        status: sale.status,
        aprovado: sale.approved,
        cancelada: Boolean(sale.cancelledAt),
        data_cancelamento: sale.cancelledAt ?? null,
      })),
      "uniplus_id",
    );

    const storedSales = await this.client.select<ExternalIdRow>("crm_vendas", {
      select: "id,uniplus_id",
    });
    const saleIds = new Map(storedSales.map((row) => [row.uniplus_id, row.id]));

    await this.client.upsert(
      "crm_itens_venda",
      items.map((item) => ({
        uniplus_id: item.id,
        venda_id: saleIds.get(item.saleId),
        produto_id: item.productId
          ? productIds.get(item.productId) ?? null
          : null,
        codigo_produto: item.productCode ?? null,
        nome_produto: item.productName ?? "",
        quantidade: item.quantity,
        valor_estimado: roundCurrency((productPrices.get(item.productId as number) ?? 0) * item.quantity),
      })),
      "uniplus_id",
    );
  }

  async saveIgnoredSales(ignoredSales: IgnoredSale[]) {
    if (ignoredSales.length === 0) return;
    const existing = await this.client.select<{ uniplus_venda_id: number | null }>(
      "crm_vendas_ignoradas",
      { select: "uniplus_venda_id" },
    );
    const existingIds = new Set(
      existing.flatMap((row) =>
        row.uniplus_venda_id === null ? [] : [row.uniplus_venda_id],
      ),
    );
    const newRows = ignoredSales.filter((sale) => !existingIds.has(sale.saleId));
    if (newRows.length === 0) return;
    await this.client.insert(
      "crm_vendas_ignoradas",
      newRows.map((sale) => ({
        uniplus_venda_id: sale.saleId,
        motivo: sale.reason,
        dados: sale.data,
      })),
      false,
    );
  }

  async finishSync(syncId: string, result: SyncResult) {
    await this.client.update("crm_sincronizacoes", { id: syncId }, {
      status: "concluida",
      fim: result.finishedAt,
      total_lidos: result.totalRead,
      total_importados: result.totalImported,
      total_ignorados: result.totalIgnored,
    });
  }
}

function mapClient(client: UniplusClient) {
  const quality = calculateRegistrationQuality(client);
  return {
    uniplus_id: client.id,
    codigo: client.code ?? null,
    nome: client.name,
    razao_social: client.legalName ?? null,
    cpf_cnpj: client.document ?? null,
    telefone: client.phone ?? null,
    celular: client.mobile ?? null,
    whatsapp: client.whatsapp ?? null,
    email: client.email ?? null,
    endereco: client.address ?? null,
    bairro: client.neighborhood ?? null,
    cidade_id: client.cityId ?? null,
    estado_id: client.stateId ?? null,
    cep: client.zipCode ?? null,
    data_cadastro: client.registeredAt ?? null,
    data_ultima_compra: client.lastPurchaseAt ?? null,
    inativo: client.inactive,
    categoria_cliente_id: client.categoryId ?? null,
    classificacao_cliente_id: client.classificationId ?? null,
    ciclo_compras: client.purchaseCycleDays ?? null,
    qualidade_cadastro_score: quality.score,
    qualidade_cadastro_status: quality.status,
  };
}

function mapProduct(product: UniplusProduct) {
  return {
    uniplus_id: product.id,
    codigo: product.code ?? null,
    nome: product.name,
    tipo: product.type ?? null,
    departamento: product.department ?? null,
    fabricante_id: product.manufacturerId ?? null,
    fornecedor: product.supplier ?? null,
    preco: product.price,
    data_ultima_venda: product.lastSaleAt ?? null,
    data_ultima_compra: product.lastPurchaseAt ?? null,
    tipo_produto: product.productType ?? null,
    utiliza_crm: product.usesCrm,
    recompra_ativa: product.usesCrm,
    dias_recompra_padrao: null,
  };
}

function mapSeller(seller: UniplusSeller) {
  return {
    uniplus_id: seller.id,
    nome: seller.name,
    email: seller.email ?? null,
    celular: seller.mobile ?? null,
    whatsapp: seller.whatsapp ?? null,
    supervisor: seller.supervisor,
    inativo: seller.inactive,
    perfil_id: seller.profileId ?? null,
  };
}
