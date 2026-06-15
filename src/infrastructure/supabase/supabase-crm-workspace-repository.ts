import "server-only";

import type {
  ContactChannel,
  ContactOutcome,
  CrmAgendaEvent,
  CrmContactRecord,
  CrmOpportunity,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import { crmUuid } from "@/domain/crm/rules";
import type { ICrmWorkspaceRepository } from "@/infrastructure/crm-workspace-contract";
import { crmDemoService } from "@/services/crm-demo-service";
import { SupabaseRestClient } from "./supabase-rest-client";

type ClientRow = { id: string; uniplus_id: number; nome: string };
type SellerRow = { id: string; uniplus_id: number; nome: string };
type ProductRow = { id: string; uniplus_id: number; nome: string };
type ContactRow = {
  id: string;
  cliente_id: string;
  vendedor_id: string | null;
  tipo_contato: string;
  data_contato: string;
  resultado: string | null;
  observacao: string | null;
  proximo_contato: string | null;
  responsavel_nome: string | null;
};
type AlertRow = { id: string; status: RepurchaseAlertStatus };
type AgendaRow = {
  id: string;
  titulo: string;
  tipo: CrmAgendaEvent["type"];
  data_evento: string;
  hora_evento: string;
  cliente_id: string | null;
  vendedor_id: string | null;
};
type OpportunityRow = {
  id: string;
  cliente_id: string;
  produto_origem_id: string | null;
  produto_sugerido_nome: string;
  motivo: string | null;
  confianca: number | null;
  status: CrmOpportunity["status"];
  vendedor_responsavel_id: string | null;
};

export class SupabaseCrmWorkspaceRepository implements ICrmWorkspaceRepository {
  constructor(private readonly client = new SupabaseRestClient()) {}

  async getWorkspace(): Promise<CrmWorkspace> {
    const snapshot = crmDemoService.getSnapshot();
    const currentClientIds = new Set(
      snapshot.customers.map((customer) => customer.uniplusId),
    );
    const currentSellerIds = new Set(
      snapshot.sellers.map((seller) => seller.uniplusId),
    );
    const currentProductIds = new Set(
      snapshot.products.map((product) => product.uniplusId),
    );
    const currentAlertIds = new Set(snapshot.alerts.map((alert) => alert.id));
    const [clients, sellers, products, contacts, alerts, agenda, opportunities] =
      await Promise.all([
        this.client.select<ClientRow>("crm_clientes", {
          select: "id,uniplus_id,nome",
        }),
        this.client.select<SellerRow>("crm_vendedores", {
          select: "id,uniplus_id,nome",
        }),
        this.client.select<ProductRow>("crm_produtos", {
          select: "id,uniplus_id,nome",
        }),
        this.client.select<ContactRow>("crm_historico_contatos", {
          select:
            "id,cliente_id,vendedor_id,tipo_contato,data_contato,resultado,observacao,proximo_contato,responsavel_nome",
          order: "data_contato.desc",
        }),
        this.client.select<AlertRow>("crm_alertas_recompra", {
          select: "id,status",
        }),
        this.client.select<AgendaRow>("crm_agenda_eventos", {
          select:
            "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id",
          order: "data_evento.asc,hora_evento.asc",
        }),
        this.client.select<OpportunityRow>("crm_oportunidades", {
          select:
            "id,cliente_id,produto_origem_id,produto_sugerido_nome,motivo,confianca,status,vendedor_responsavel_id",
          order: "created_at.desc",
        }),
      ]);

    const clientById = new Map(
      clients
        .filter((row) => currentClientIds.has(row.uniplus_id))
        .map((row) => [row.id, row]),
    );
    const sellerById = new Map(
      sellers
        .filter((row) => currentSellerIds.has(row.uniplus_id))
        .map((row) => [row.id, row]),
    );
    const productById = new Map(
      products
        .filter((row) => currentProductIds.has(row.uniplus_id))
        .map((row) => [row.id, row]),
    );

    return {
      contacts: contacts.flatMap((row) => {
        const customer = clientById.get(row.cliente_id);
        if (!customer) return [];
        return [{
          id: row.id,
          customerId: crmUuid("customer", customer.uniplus_id),
          customerName: customer.nome,
          outcome: fromDatabaseOutcome(row.resultado),
          note: row.observacao ?? "",
          nextContact: row.proximo_contato ?? "",
          contactedAt: formatContactDate(row.data_contato),
          channel: fromDatabaseChannel(row.tipo_contato),
          responsible:
            row.responsavel_nome ??
            (row.vendedor_id ? sellerById.get(row.vendedor_id)?.nome : undefined) ??
            "Hennder CRM",
        }];
      }),
      alertStatuses: Object.fromEntries(
        alerts
          .filter((row) => currentAlertIds.has(row.id))
          .map((row) => [row.id, row.status]),
      ),
      agenda: agenda
        .filter((row) => !row.cliente_id || clientById.has(row.cliente_id))
        .map((row) => ({
          id: row.id,
          date: row.data_evento,
          time: row.hora_evento.slice(0, 5),
          title: row.titulo,
          type: row.tipo,
          customerId: row.cliente_id
            ? toCustomerDomainId(clientById.get(row.cliente_id))
            : undefined,
          sellerId: row.vendedor_id
            ? toSellerDomainId(sellerById.get(row.vendedor_id))
            : undefined,
        })),
      opportunities: opportunities.flatMap((row) => {
        const customer = clientById.get(row.cliente_id);
        if (!customer) return [];
        const seller = row.vendedor_responsavel_id
          ? sellerById.get(row.vendedor_responsavel_id)
          : undefined;
        return [{
          id: row.id,
          customerId: crmUuid("customer", customer.uniplus_id),
          customerName: customer.nome,
          sourceProductName: row.produto_origem_id
            ? productById.get(row.produto_origem_id)?.nome ?? "Produto não informado"
            : "Produto não informado",
          suggestedProductName: row.produto_sugerido_nome,
          reason: row.motivo ?? "",
          confidence: row.confianca ?? 0,
          status: row.status,
          sellerId: seller ? crmUuid("seller", seller.uniplus_id) : undefined,
          sellerName: seller?.nome ?? "Não atribuído",
        }];
      }),
    };
  }

  async createContact(input: Omit<CrmContactRecord, "id">) {
    const customer = await this.resolveCustomer(input.customerId);
    const sellerId = await this.resolvePreferredSellerId(input.customerId);
    const [row] = await this.client.insert<{ id: string }>(
      "crm_historico_contatos",
      [{
        cliente_id: customer.id,
        vendedor_id: sellerId,
        tipo_contato: toDatabaseChannel(input.channel),
        data_contato: new Date().toISOString(),
        resultado: toDatabaseOutcome(input.outcome),
        observacao: input.note || null,
        proximo_contato: input.nextContact || null,
        responsavel_nome: input.responsible,
      }],
    );
    return { ...input, id: row.id };
  }

  async updateAlertStatus(id: string, status: RepurchaseAlertStatus) {
    const rows = await this.client.update<{ id: string }>(
      "crm_alertas_recompra",
      { id },
      { status },
    );
    if (rows.length === 0) throw new Error("Alerta não encontrado no Supabase.");
    return { id, status };
  }

  async createAgendaEvent(input: Omit<CrmAgendaEvent, "id">) {
    const [row] = await this.client.insert<{ id: string }>("crm_agenda_eventos", [
      await this.mapAgendaValues(input),
    ]);
    return { ...input, id: row.id };
  }

  async updateAgendaEvent(
    id: string,
    values: Partial<Omit<CrmAgendaEvent, "id">>,
  ) {
    const mapped = await this.mapAgendaValues(values);
    const rows = await this.client.update<AgendaRow>(
      "crm_agenda_eventos",
      { id },
      mapped,
    );
    const row = rows[0];
    if (!row) throw new Error("Evento de agenda não encontrado.");
    return {
      id: row.id,
      date: row.data_evento,
      time: row.hora_evento.slice(0, 5),
      title: row.titulo,
      type: row.tipo,
      customerId: values.customerId,
      sellerId: values.sellerId,
    };
  }

  async deleteAgendaEvent(id: string) {
    await this.client.delete("crm_agenda_eventos", { id });
  }

  async createOpportunity(input: Omit<CrmOpportunity, "id">) {
    const [row] = await this.client.insert<{ id: string }>("crm_oportunidades", [
      await this.mapOpportunityValues(input),
    ]);
    return { ...input, id: row.id };
  }

  async updateOpportunity(
    id: string,
    values: Partial<Omit<CrmOpportunity, "id">>,
  ) {
    const mapped = await this.mapOpportunityValues(values);
    const rows = await this.client.update<{ id: string }>(
      "crm_oportunidades",
      { id },
      mapped,
    );
    if (rows.length === 0) throw new Error("Oportunidade não encontrada.");
    const workspace = await this.getWorkspace();
    const opportunity = workspace.opportunities.find((item) => item.id === id);
    if (!opportunity) throw new Error("Oportunidade não encontrada.");
    return opportunity;
  }

  async deleteOpportunity(id: string) {
    await this.client.delete("crm_oportunidades", { id });
  }

  private async resolveCustomer(domainId: string) {
    const snapshot = crmDemoService.getSnapshot();
    const customer = snapshot.customers.find((item) => item.id === domainId);
    if (!customer) throw new Error("Cliente não encontrado.");
    const rows = await this.client.select<ClientRow>("crm_clientes", {
      select: "id,uniplus_id,nome",
      uniplus_id: `eq.${customer.uniplusId}`,
      limit: 1,
    });
    if (!rows[0]) throw new Error("Cliente ainda não foi carregado no Supabase.");
    return rows[0];
  }

  private async resolveSeller(domainId?: string) {
    if (!domainId) return undefined;
    const snapshot = crmDemoService.getSnapshot();
    const seller = snapshot.sellers.find((item) => item.id === domainId);
    if (!seller) return undefined;
    const rows = await this.client.select<SellerRow>("crm_vendedores", {
      select: "id,uniplus_id,nome",
      uniplus_id: `eq.${seller.uniplusId}`,
      limit: 1,
    });
    return rows[0];
  }

  private async resolvePreferredSellerId(customerDomainId: string) {
    const snapshot = crmDemoService.getSnapshot();
    const customer = snapshot.customers.find((item) => item.id === customerDomainId);
    const seller = snapshot.sellers.find(
      (item) => item.uniplusId === customer?.preferredSeller?.sellerId,
    );
    return seller ? (await this.resolveSeller(seller.id))?.id ?? null : null;
  }

  private async resolveProductId(name?: string) {
    if (!name) return null;
    const product = crmDemoService
      .getSnapshot()
      .products.find((item) => item.name === name);
    if (!product) return null;
    const rows = await this.client.select<ProductRow>("crm_produtos", {
      select: "id,uniplus_id,nome",
      uniplus_id: `eq.${product.uniplusId}`,
      limit: 1,
    });
    return rows[0]?.id ?? null;
  }

  private async mapAgendaValues(
    values: Partial<Omit<CrmAgendaEvent, "id">>,
  ) {
    return {
      ...(values.title !== undefined ? { titulo: values.title } : {}),
      ...(values.type !== undefined ? { tipo: values.type } : {}),
      ...(values.date !== undefined ? { data_evento: values.date } : {}),
      ...(values.time !== undefined ? { hora_evento: values.time } : {}),
      ...(values.customerId !== undefined
        ? {
            cliente_id: values.customerId
              ? (await this.resolveCustomer(values.customerId)).id
              : null,
          }
        : {}),
      ...(values.sellerId !== undefined
        ? {
            vendedor_id: values.sellerId
              ? (await this.resolveSeller(values.sellerId))?.id ?? null
              : null,
          }
        : {}),
    };
  }

  private async mapOpportunityValues(
    values: Partial<Omit<CrmOpportunity, "id">>,
  ) {
    return {
      ...(values.customerId !== undefined
        ? { cliente_id: (await this.resolveCustomer(values.customerId)).id }
        : {}),
      ...(values.sourceProductName !== undefined
        ? {
            produto_origem_id: await this.resolveProductId(
              values.sourceProductName,
            ),
          }
        : {}),
      ...(values.suggestedProductName !== undefined
        ? { produto_sugerido_nome: values.suggestedProductName }
        : {}),
      ...(values.reason !== undefined ? { motivo: values.reason } : {}),
      ...(values.confidence !== undefined
        ? { confianca: values.confidence }
        : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(values.sellerId !== undefined
        ? {
            vendedor_responsavel_id: values.sellerId
              ? (await this.resolveSeller(values.sellerId))?.id ?? null
              : null,
          }
        : {}),
    };
  }
}

function toCustomerDomainId(row?: ClientRow) {
  return row ? crmUuid("customer", row.uniplus_id) : undefined;
}

function toSellerDomainId(row?: SellerRow) {
  return row ? crmUuid("seller", row.uniplus_id) : undefined;
}

function formatContactDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function toDatabaseChannel(channel: ContactChannel) {
  return {
    WhatsApp: "whatsapp",
    Telefone: "telefone",
    Visita: "visita",
    Presencial: "presencial",
    Email: "email",
  }[channel];
}

function fromDatabaseChannel(value: string): ContactChannel {
  const channels: Record<string, ContactChannel> = {
    whatsapp: "WhatsApp",
    telefone: "Telefone",
    visita: "Visita",
    presencial: "Presencial",
    email: "Email",
  };
  return channels[value] ?? "Telefone";
}

function toDatabaseOutcome(outcome: ContactOutcome) {
  return {
    not_interested: "nao_interessado",
    follow_up: "remarcar",
    no_answer: "sem_resposta",
    interested: "interessado",
    invalid_number: "atualizar_cadastro",
  }[outcome];
}

function fromDatabaseOutcome(value: string | null): ContactOutcome {
  const outcomes: Record<string, ContactOutcome> = {
    nao_interessado: "not_interested",
    remarcar: "follow_up",
    sem_resposta: "no_answer",
    interessado: "interested",
    comprou: "interested",
    atualizar_cadastro: "invalid_number",
  };
  return outcomes[value ?? ""] ?? "no_answer";
}
