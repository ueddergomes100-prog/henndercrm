import "server-only";

import type {
  ContactChannel,
  ContactOutcome,
  CrmAgendaEvent,
  CrmContactRecord,
  CrmContactSaveResult,
  CrmOpportunity,
  CrmRepurchaseAlert,
  CrmWorkspace,
  RegistrationQualityStatus,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import type {
  CustomerContactUpdateInput,
  CustomerContactUpdateResult,
  ICrmWorkspaceRepository,
  ManualCustomerInput,
  ManualCustomerResult,
  ManualRepurchaseAlertInput,
} from "@/infrastructure/crm-workspace-contract";
import { SupabaseRestClient } from "./supabase-rest-client";

type ClientRow = { id: string; uniplus_id: number | null; nome: string };
type ClientContactRow = {
  id: string;
  nome: string;
  telefone: string | null;
  celular: string | null;
  whatsapp: string | null;
};
type ManualClientRow = ClientContactRow & {
  uniplus_id: number | null;
  data_cadastro: string | null;
  ciclo_compras: number | null;
  qualidade_cadastro_score: number | null;
  qualidade_cadastro_status: RegistrationQualityStatus | null;
};
type SellerRow = { id: string; uniplus_id: number; nome: string };
type ProductRow = { id: string; uniplus_id: number; nome: string; departamento?: string | null };
type SaleForAlertRow = {
  id: string;
  vendedor_id: string | null;
  data_venda: string;
};
type SaleForFollowUpRow = {
  cliente_id: string;
  data_venda: string;
  aprovado: boolean;
};
type SaleItemForAlertRow = {
  id: string;
  venda_id: string;
  produto_id: string | null;
};
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
type ManualAlertRow = {
  id: string;
  cliente_id: string;
  produto_id: string;
  venda_id: string;
  item_venda_id: string;
  vendedor_responsavel_id: string | null;
  data_compra: string;
  data_prevista_recompra: string;
  dias_recompra: number;
  status: RepurchaseAlertStatus;
  prioridade: CrmRepurchaseAlert["priority"];
  origem: CrmRepurchaseAlert["origin"];
  observacao: string | null;
};
type AgendaRow = {
  id: string;
  titulo: string;
  tipo: CrmAgendaEvent["type"];
  data_evento: string;
  hora_evento: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  concluido: boolean;
  observacao: string | null;
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
    const [clients, sellers, products, contacts, alerts, agenda, opportunities, sales] =
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
            "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id,concluido,observacao",
          order: "data_evento.asc,hora_evento.asc",
        }),
        this.client.select<OpportunityRow>("crm_oportunidades", {
          select:
            "id,cliente_id,produto_origem_id,produto_sugerido_nome,motivo,confianca,status,vendedor_responsavel_id",
          order: "created_at.desc",
        }),
        this.client.select<SaleForFollowUpRow>("crm_vendas", {
          select: "cliente_id,data_venda,aprovado",
          aprovado: "eq.true",
          order: "data_venda.desc",
        }),
      ]);

    const clientById = new Map(clients.map((row) => [row.id, row]));
    const sellerById = new Map(sellers.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));
    const activeAgenda = await this.removePurchasedFollowUps(agenda, contacts, sales);

    return {
      contacts: contacts.flatMap((row) => {
        const customer = clientById.get(row.cliente_id);
        if (!customer) return [];
        return [{
          id: row.id,
          customerId: customer.id,
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
          sellerId: row.vendedor_id ?? undefined,
        }];
      }),
      alertStatuses: Object.fromEntries(
        alerts.map((row) => [row.id, row.status]),
      ),
      agenda: activeAgenda
        .filter((row) => !row.cliente_id || clientById.has(row.cliente_id))
        .map(mapAgendaRow),
      opportunities: opportunities.flatMap((row) => {
        const customer = clientById.get(row.cliente_id);
        if (!customer) return [];
        const seller = row.vendedor_responsavel_id
          ? sellerById.get(row.vendedor_responsavel_id)
          : undefined;
        return [{
          id: row.id,
          customerId: customer.id,
          customerName: customer.nome,
          sourceProductName: row.produto_origem_id
            ? productById.get(row.produto_origem_id)?.nome ?? "Produto nao informado"
            : "Produto nao informado",
          suggestedProductName: row.produto_sugerido_nome,
          reason: row.motivo ?? "",
          confidence: row.confianca ?? 0,
          status: row.status,
          sellerId: seller?.id,
          sellerName: seller?.nome ?? "Nao atribuido",
        }];
      }),
    };
  }

  async createContact(
    input: Omit<CrmContactRecord, "id">,
  ): Promise<CrmContactSaveResult> {
    const customer = await this.resolveCustomer(input.customerId);
    const requestedSeller = input.sellerId
      ? await this.resolveSeller(input.sellerId)
      : undefined;
    const sellerId = requestedSeller?.id ?? await this.resolvePreferredSellerId(input.customerId);
    const responsible = requestedSeller?.nome ?? input.responsible;
    const channel = toDatabaseChannel(input.channel);
    const automaticContact = isAutomaticContactNote(input.note);
    const existingAutomaticContact = automaticContact
      ? await this.findAutomaticContactToday(customer.id, channel, sellerId ?? undefined)
      : undefined;

    if (existingAutomaticContact) {
      const contact = {
        ...input,
        id: existingAutomaticContact.id,
        outcome: fromDatabaseOutcome(existingAutomaticContact.resultado),
        note: existingAutomaticContact.observacao ?? input.note,
        nextContact: existingAutomaticContact.proximo_contato ?? "",
        contactedAt: formatContactDate(existingAutomaticContact.data_contato),
        channel: fromDatabaseChannel(existingAutomaticContact.tipo_contato),
        responsible: existingAutomaticContact.responsavel_nome ?? responsible,
        sellerId: existingAutomaticContact.vendedor_id ?? sellerId ?? undefined,
      };
      return { contact, removedFollowUpIds: [] };
    }

    const [row] = await this.client.insert<{ id: string }>(
      "crm_historico_contatos",
      [{
        cliente_id: customer.id,
        vendedor_id: sellerId,
        tipo_contato: channel,
        data_contato: new Date().toISOString(),
        resultado: toDatabaseOutcome(input.outcome),
        observacao: input.note || null,
        proximo_contato: input.nextContact || null,
        responsavel_nome: responsible,
      }],
    );
    const contact: CrmContactRecord = {
      ...input,
      id: row.id,
      responsible,
      sellerId: sellerId ?? undefined,
    };

    if (automaticContact || !sellerId) {
      return { contact, removedFollowUpIds: [] };
    }

    const existingFollowUps = await this.findOpenFollowUps(customer.id, sellerId);
    const removedFollowUpIds = existingFollowUps.map((event) => event.id);
    let followUp: CrmAgendaEvent | undefined;

    if (input.nextContact) {
      const values = {
        titulo: `Retorno: ${customer.nome}`,
        tipo: "Retorno" as const,
        data_evento: input.nextContact,
        hora_evento: "09:00",
        cliente_id: customer.id,
        vendedor_id: sellerId,
        concluido: false,
        observacao: followUpNote(row.id),
      };
      const savedRows = existingFollowUps[0]
        ? await this.client.update<AgendaRow>(
            "crm_agenda_eventos",
            { id: existingFollowUps[0].id },
            values,
          )
        : await this.client.insert<AgendaRow>("crm_agenda_eventos", [values]);
      const savedRow = savedRows[0];
      if (!savedRow) throw new Error("Nao foi possivel agendar o retorno.");
      followUp = mapAgendaRow(savedRow);

      for (const duplicate of existingFollowUps.slice(1)) {
        await this.client.delete("crm_agenda_eventos", { id: duplicate.id });
      }
    } else {
      for (const event of existingFollowUps) {
        await this.client.delete("crm_agenda_eventos", { id: event.id });
      }
    }

    return { contact, followUp, removedFollowUpIds };
  }

  async createManualCustomer(input: ManualCustomerInput): Promise<ManualCustomerResult> {
    const name = input.name.trim();
    if (!name) throw new Error("Informe o nome do cliente.");

    const phone = input.phone?.trim() ?? "";
    const whatsapp = input.whatsapp?.trim() || phone;
    const purchaseCycleDays = Math.max(1, Math.round(input.purchaseCycleDays || 45));
    const seller = input.sellerId ? await this.resolveSeller(input.sellerId) : undefined;

    const [row] = await this.client.insert<ManualClientRow>("crm_clientes", [
      {
        nome: name,
        telefone: phone || whatsapp || null,
        celular: whatsapp || phone || null,
        whatsapp: whatsapp || phone || null,
        data_cadastro: new Date().toISOString(),
        inativo: false,
        ciclo_compras: purchaseCycleDays,
      },
    ]);

    return {
      id: row.id,
      uniplusId: row.uniplus_id,
      name: row.nome,
      phone: row.telefone ?? phone,
      whatsapp: row.whatsapp ?? row.celular ?? whatsapp,
      city: input.city?.trim() || "Cidade nao informada",
      category: input.category?.trim() || "Cliente manual",
      purchaseCycleDays: row.ciclo_compras ?? purchaseCycleDays,
      qualityScore: row.qualidade_cadastro_score ?? 0,
      qualityStatus: row.qualidade_cadastro_status ?? "ruim",
      sellerId: seller?.id,
      sellerName: seller?.nome,
    };
  }

  async createManualAlert(input: ManualRepurchaseAlertInput) {
    const customer = await this.resolveCustomer(input.customerId);
    const product = await this.resolveProductByName(input.productName);
    const latest = await this.findLatestSaleItemForAlert(customer.id, product.id);
    const requestedSeller = input.sellerId ? await this.resolveSeller(input.sellerId) : undefined;
    const sellerId = requestedSeller?.id ?? latest.sale.vendedor_id ?? await this.resolvePreferredSellerId(customer.id);
    const seller = sellerId ? await this.resolveSeller(sellerId) : undefined;
    const [row] = await this.client.upsert<ManualAlertRow>(
      "crm_alertas_recompra",
      [{
        cliente_id: customer.id,
        produto_id: product.id,
        venda_id: latest.sale.id,
        item_venda_id: latest.item.id,
        vendedor_responsavel_id: sellerId,
        data_compra: latest.sale.data_venda,
        data_prevista_recompra: input.recommendedIso,
        dias_recompra: Math.max(1, Math.round(input.recurrenceDays)),
        status: "pendente",
        prioridade: input.priority,
        origem: "manual",
        observacao: input.note || null,
      }],
      "cliente_id,produto_id,venda_id,item_venda_id",
    );

    return {
      id: row.id,
      customerId: customer.id,
      customerName: customer.nome,
      productId: product.id,
      productName: product.nome,
      sellerId: sellerId ?? undefined,
      sellerName: seller?.nome ?? requestedSeller?.nome ?? "Nao atribuido",
      saleId: latest.sale.id,
      saleItemId: latest.item.id,
      purchaseDate: latest.sale.data_venda.slice(0, 10),
      expectedDate: row.data_prevista_recompra,
      repurchaseDays: row.dias_recompra,
      status: row.status,
      priority: row.prioridade,
      origin: row.origem,
      department: product.departamento ?? "",
      note: row.observacao ?? undefined,
    } satisfies CrmRepurchaseAlert;
  }

  async updateCustomerContact(
    input: CustomerContactUpdateInput,
  ): Promise<CustomerContactUpdateResult> {
    const phone = input.phone.trim();
    const whatsapp = input.whatsapp.trim() || phone;
    if (!phone && !whatsapp) throw new Error("Informe um telefone ou WhatsApp valido.");

    const rows = await this.client.update<ClientContactRow>(
      "crm_clientes",
      { id: input.customerId },
      {
        telefone: phone || whatsapp,
        celular: whatsapp || phone,
        whatsapp: whatsapp || phone,
      },
    );
    const row = rows[0];
    if (!row) throw new Error("Cliente nao encontrado no Supabase.");

    const invalidatedContactIds: string[] = [];
    if (input.retryWhatsApp) {
      const automaticContact = await this.findAutomaticContactToday(
        row.id,
        "whatsapp",
        input.sellerId,
      );
      if (automaticContact) {
        await this.client.update(
          "crm_historico_contatos",
          { id: automaticContact.id },
          { resultado: "atualizar_cadastro" },
        );
        invalidatedContactIds.push(automaticContact.id);
      }
    }

    return {
      customerId: row.id,
      customerName: row.nome,
      phone: row.telefone ?? phone,
      whatsapp: row.whatsapp ?? row.celular ?? whatsapp,
      invalidatedContactIds,
    };
  }

  async updateAlertStatus(id: string, status: RepurchaseAlertStatus) {
    const rows = await this.client.update<{ id: string }>(
      "crm_alertas_recompra",
      { id },
      { status },
    );
    if (rows.length === 0) throw new Error("Alerta nao encontrado no Supabase.");
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
    if (!row) throw new Error("Evento de agenda nao encontrado.");
    return mapAgendaRow(row);
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
    if (rows.length === 0) throw new Error("Oportunidade nao encontrada.");
    const workspace = await this.getWorkspace();
    const opportunity = workspace.opportunities.find((item) => item.id === id);
    if (!opportunity) throw new Error("Oportunidade nao encontrada.");
    return opportunity;
  }

  async deleteOpportunity(id: string) {
    await this.client.delete("crm_oportunidades", { id });
  }

  private async findAutomaticContactToday(
    customerId: string,
    channel: string,
    sellerId?: string,
  ) {
    const rows = await this.client.select<ContactRow>("crm_historico_contatos", {
      select:
        "id,cliente_id,vendedor_id,tipo_contato,data_contato,resultado,observacao,proximo_contato,responsavel_nome",
      cliente_id: `eq.${customerId}`,
      tipo_contato: `eq.${channel}`,
      ...(sellerId ? { vendedor_id: `eq.${sellerId}` } : {}),
      data_contato: `gte.${todayStartIso()}`,
      order: "data_contato.desc",
      limit: 25,
    });

    return rows.find(
      (row) =>
        row.resultado !== "atualizar_cadastro" &&
        isAutomaticContactNote(row.observacao ?? ""),
    );
  }

  private async findOpenFollowUps(customerId: string, sellerId: string) {
    const rows = await this.client.select<AgendaRow>("crm_agenda_eventos", {
      select:
        "id,titulo,tipo,data_evento,hora_evento,cliente_id,vendedor_id,concluido,observacao",
      cliente_id: `eq.${customerId}`,
      vendedor_id: `eq.${sellerId}`,
      tipo: "eq.Retorno",
      concluido: "eq.false",
      order: "data_evento.asc,hora_evento.asc",
    });
    return rows.filter((row) => Boolean(contactIdFromFollowUpNote(row.observacao)));
  }

  private async removePurchasedFollowUps(
    agenda: AgendaRow[],
    contacts: ContactRow[],
    sales: SaleForFollowUpRow[],
  ) {
    const latestSaleByCustomer = new Map<string, string>();
    for (const sale of sales) {
      if (!sale.aprovado) continue;
      const soldAt = dateOnly(sale.data_venda);
      const current = latestSaleByCustomer.get(sale.cliente_id);
      if (!current || soldAt > current) latestSaleByCustomer.set(sale.cliente_id, soldAt);
    }
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    const staleIds = new Set(
      agenda.flatMap((event) => {
        const contactId = contactIdFromFollowUpNote(event.observacao);
        if (!contactId || !event.cliente_id) return [];
        const contact = contactsById.get(contactId);
        const latestSale = latestSaleByCustomer.get(event.cliente_id);
        if (!contact || (latestSale && latestSale >= dateOnly(contact.data_contato))) {
          return [event.id];
        }
        return [];
      }),
    );

    for (const id of staleIds) {
      await this.client.delete("crm_agenda_eventos", { id });
    }
    return agenda.filter((event) => !staleIds.has(event.id));
  }

  private async resolveProductByName(name: string) {
    const rows = await this.client.select<ProductRow>("crm_produtos", {
      select: "id,uniplus_id,nome,departamento",
      nome: `eq.${name}`,
      limit: 1,
    });
    if (!rows[0]) throw new Error("Produto ainda nao foi carregado no Supabase.");
    return rows[0];
  }

  private async findLatestSaleItemForAlert(customerId: string, productId: string) {
    const sales = await this.client.select<SaleForAlertRow>("crm_vendas", {
      select: "id,vendedor_id,data_venda",
      cliente_id: `eq.${customerId}`,
      order: "data_venda.desc",
      limit: 100,
    });
    const saleIds = sales.map((sale) => sale.id);
    if (!saleIds.length) {
      throw new Error("Cliente ainda nao possui venda importada para criar alerta manual.");
    }

    const items = await this.client.select<SaleItemForAlertRow>("crm_itens_venda", {
      select: "id,venda_id,produto_id",
      produto_id: `eq.${productId}`,
      venda_id: `in.(${saleIds.join(",")})`,
      limit: 100,
    });
    const itemBySaleId = new Map(items.map((item) => [item.venda_id, item]));
    const sale = sales.find((item) => itemBySaleId.has(item.id));
    const saleItem = sale ? itemBySaleId.get(sale.id) : undefined;
    if (!sale || !saleItem) {
      throw new Error("Este cliente ainda nao tem compra importada deste produto.");
    }

    return { sale, item: saleItem };
  }

  private async resolveCustomer(domainId: string) {
    const rows = await this.client.select<ClientRow>("crm_clientes", {
      select: "id,uniplus_id,nome",
      id: `eq.${domainId}`,
      limit: 1,
    });
    if (!rows[0]) throw new Error("Cliente ainda nao foi carregado no Supabase.");
    return rows[0];
  }

  private async resolveSeller(domainId?: string) {
    if (!domainId) return undefined;
    const rows = await this.client.select<SellerRow>("crm_vendedores", {
      select: "id,uniplus_id,nome",
      id: `eq.${domainId}`,
      limit: 1,
    });
    return rows[0];
  }

  private async resolvePreferredSellerId(customerDomainId: string) {
    const rows = await this.client.select<{ vendedor_id: string | null }>("crm_vendas", {
      select: "vendedor_id",
      cliente_id: `eq.${customerDomainId}`,
      order: "data_venda.desc",
      limit: 1,
    });
    return rows[0]?.vendedor_id ?? null;
  }

  private async resolveProductId(name?: string) {
    if (!name) return null;
    const rows = await this.client.select<ProductRow>("crm_produtos", {
      select: "id,uniplus_id,nome",
      nome: `eq.${name}`,
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
      ...(values.completed !== undefined ? { concluido: values.completed } : {}),
      ...(values.note !== undefined ? { observacao: values.note || null } : {}),
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
        ? { produto_origem_id: await this.resolveProductId(values.sourceProductName) }
        : {}),
      ...(values.suggestedProductName !== undefined
        ? { produto_sugerido_nome: values.suggestedProductName }
        : {}),
      ...(values.reason !== undefined ? { motivo: values.reason } : {}),
      ...(values.confidence !== undefined ? { confianca: values.confidence } : {}),
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

function formatContactDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function todayStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function isAutomaticContactNote(note: string) {
  return note.trim().toLowerCase().startsWith("registro autom");
}

const FOLLOW_UP_NOTE_PREFIX = "crm_follow_up_contact:";

function followUpNote(contactId: string) {
  return `${FOLLOW_UP_NOTE_PREFIX}${contactId}`;
}

function contactIdFromFollowUpNote(note: string | null | undefined) {
  const value = note?.trim() ?? "";
  return value.startsWith(FOLLOW_UP_NOTE_PREFIX)
    ? value.slice(FOLLOW_UP_NOTE_PREFIX.length) || undefined
    : undefined;
}

function mapAgendaRow(row: AgendaRow): CrmAgendaEvent {
  return {
    id: row.id,
    date: row.data_evento,
    time: row.hora_evento.slice(0, 5),
    title: row.titulo,
    type: row.tipo,
    customerId: row.cliente_id ?? undefined,
    sellerId: row.vendedor_id ?? undefined,
    completed: row.concluido,
    note: row.observacao ?? undefined,
    contactId: contactIdFromFollowUpNote(row.observacao),
  };
}

function dateOnly(value: string) {
  return value.slice(0, 10);
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
