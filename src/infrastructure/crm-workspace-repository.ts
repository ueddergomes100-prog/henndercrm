import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CrmAgendaEvent,
  CrmContactRecord,
  CrmContactSaveResult,
  CrmOpportunity,
  CrmRepurchaseAlert,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import type {
  CustomerContactUpdateInput,
  CustomerContactUpdateResult,
  ICrmWorkspaceRepository,
  ManualCustomerInput,
  ManualCustomerResult,
  ManualRepurchaseAlertInput,
} from "./crm-workspace-contract";

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "crm-workspace.json");

export class CrmWorkspaceRepository implements ICrmWorkspaceRepository {
  private writeQueue = Promise.resolve();

  async getWorkspace(): Promise<CrmWorkspace> {
    try {
      return normalizeWorkspace(JSON.parse(await readFile(dataFile, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const workspace = createInitialWorkspace();
      await this.save(workspace);
      return workspace;
    }
  }

  async createContact(
    input: Omit<CrmContactRecord, "id">,
  ): Promise<CrmContactSaveResult> {
    const workspace = await this.getWorkspace();
    const record = {
      ...input,
      id:
        Math.max(
          0,
          ...workspace.contacts
            .map((contact) => Number(contact.id))
            .filter(Number.isFinite),
        ) + 1,
    };
    workspace.contacts.unshift(record);

    const existingFollowUps = workspace.agenda.filter(
      (event) =>
        Boolean(event.contactId) &&
        event.customerId === input.customerId &&
        (!input.sellerId || event.sellerId === input.sellerId),
    );
    const removedFollowUpIds = existingFollowUps.map((event) => event.id);
    let followUp: CrmAgendaEvent | undefined;

    workspace.agenda = workspace.agenda.filter(
      (event) => !removedFollowUpIds.includes(event.id),
    );
    if (input.nextContact) {
      followUp = {
        id: existingFollowUps[0]?.id ?? randomUUID(),
        date: input.nextContact,
        time: "09:00",
        title: `Retorno: ${input.customerName}`,
        type: "Retorno",
        customerId: input.customerId,
        sellerId: input.sellerId,
        completed: false,
        note: followUpNote(String(record.id)),
        contactId: String(record.id),
      };
      workspace.agenda.push(followUp);
    }

    await this.save(workspace);
    return { contact: record, followUp, removedFollowUpIds };
  }

  async createManualCustomer(input: ManualCustomerInput): Promise<ManualCustomerResult> {
    const phone = input.phone?.trim() ?? "";
    const whatsapp = input.whatsapp?.trim() || phone;
    return {
      id: randomUUID(),
      uniplusId: null,
      name: input.name.trim(),
      phone,
      whatsapp,
      city: input.city?.trim() || "Cidade nao informada",
      category: input.category?.trim() || "Cliente manual",
      purchaseCycleDays: Math.max(1, Math.round(input.purchaseCycleDays || 45)),
      qualityScore: whatsapp ? 70 : 45,
      qualityStatus: whatsapp ? "bom" : "regular",
      sellerId: input.sellerId,
      sellerName: input.sellerId ? "Vendedor vinculado" : undefined,
    };
  }

  async createManualAlert(input: ManualRepurchaseAlertInput): Promise<CrmRepurchaseAlert> {
    return {
      id: randomUUID(),
      customerId: input.customerId,
      customerName: "Cliente manual",
      productName: input.productName,
      sellerId: input.sellerId,
      sellerName: "Hennder CRM",
      saleId: "manual",
      saleItemId: "manual",
      purchaseDate: new Date().toISOString().slice(0, 10),
      expectedDate: input.recommendedIso,
      repurchaseDays: Math.max(1, Math.round(input.recurrenceDays)),
      status: "pendente",
      priority: input.priority,
      origin: "manual",
      department: "Manual",
      note: input.note,
    };
  }

  async updateCustomerContact(
    input: CustomerContactUpdateInput,
  ): Promise<CustomerContactUpdateResult> {
    const workspace = await this.getWorkspace();
    const invalidatedContactIds = input.retryWhatsApp
      ? workspace.contacts
          .filter(
            (contact) =>
              contact.customerId === input.customerId &&
              contact.channel === "WhatsApp" &&
              (!input.sellerId || contact.sellerId === input.sellerId) &&
              contact.outcome !== "invalid_number" &&
              isAutomaticContactNote(contact.note) &&
              isToday(contact.contactedAt),
          )
          .slice(0, 1)
          .map((contact) => {
            contact.outcome = "invalid_number";
            return String(contact.id);
          })
      : [];

    if (invalidatedContactIds.length) await this.save(workspace);

    return {
      customerId: input.customerId,
      phone: input.phone.trim(),
      whatsapp: input.whatsapp.trim() || input.phone.trim(),
      invalidatedContactIds,
    };
  }

  async updateAlertStatus(id: string, status: RepurchaseAlertStatus) {
    const workspace = await this.getWorkspace();
    workspace.alertStatuses[id] = status;
    await this.save(workspace);
    return { id, status };
  }

  async createAgendaEvent(input: Omit<CrmAgendaEvent, "id">) {
    const workspace = await this.getWorkspace();
    const event = { ...input, id: randomUUID() };
    workspace.agenda.push(event);
    await this.save(workspace);
    return event;
  }

  async updateAgendaEvent(id: string, values: Partial<Omit<CrmAgendaEvent, "id">>) {
    const workspace = await this.getWorkspace();
    const index = workspace.agenda.findIndex((event) => event.id === id);
    if (index < 0) throw new Error("Evento de agenda não encontrado.");
    workspace.agenda[index] = { ...workspace.agenda[index], ...values, id };
    await this.save(workspace);
    return workspace.agenda[index];
  }

  async deleteAgendaEvent(id: string) {
    const workspace = await this.getWorkspace();
    workspace.agenda = workspace.agenda.filter((event) => event.id !== id);
    await this.save(workspace);
  }

  async createOpportunity(input: Omit<CrmOpportunity, "id">) {
    const workspace = await this.getWorkspace();
    const opportunity = { ...input, id: randomUUID() };
    workspace.opportunities.unshift(opportunity);
    await this.save(workspace);
    return opportunity;
  }

  async updateOpportunity(id: string, values: Partial<Omit<CrmOpportunity, "id">>) {
    const workspace = await this.getWorkspace();
    const index = workspace.opportunities.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Oportunidade não encontrada.");
    workspace.opportunities[index] = { ...workspace.opportunities[index], ...values, id };
    await this.save(workspace);
    return workspace.opportunities[index];
  }

  async deleteOpportunity(id: string) {
    const workspace = await this.getWorkspace();
    workspace.opportunities = workspace.opportunities.filter((item) => item.id !== id);
    await this.save(workspace);
  }

  private async save(workspace: CrmWorkspace) {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dataDirectory, { recursive: true });
      const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(workspace, null, 2), "utf8");
      await rename(temporaryFile, dataFile);
    });
    await this.writeQueue;
  }
}

function createInitialWorkspace(): CrmWorkspace {
  return {
    contacts: [],
    alertStatuses: {},
    agenda: [],
    opportunities: [],
  };
}

function normalizeWorkspace(value: Partial<CrmWorkspace>): CrmWorkspace {
  const initial = createInitialWorkspace();
  return {
    contacts: Array.isArray(value.contacts) ? value.contacts : [],
    alertStatuses:
      value.alertStatuses && typeof value.alertStatuses === "object"
        ? value.alertStatuses
        : {},
    agenda: Array.isArray(value.agenda) ? value.agenda : initial.agenda,
    opportunities: Array.isArray(value.opportunities)
      ? value.opportunities
      : initial.opportunities,
  };
}

export const crmWorkspaceRepository = new CrmWorkspaceRepository();

function isAutomaticContactNote(note: string) {
  return note.trim().toLowerCase().startsWith("registro autom");
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function followUpNote(contactId: string) {
  return `crm_follow_up_contact:${contactId}`;
}
