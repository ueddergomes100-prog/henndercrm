import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CrmAgendaEvent,
  CrmContactRecord,
  CrmOpportunity,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import { crmDemoService } from "@/services/crm-demo-service";
import type { ICrmWorkspaceRepository } from "./crm-workspace-contract";

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
  ): Promise<CrmContactRecord> {
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
    await this.save(workspace);
    return record;
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
  const snapshot = crmDemoService.getSnapshot();
  return {
    contacts: [],
    alertStatuses: {},
    agenda: snapshot.agenda,
    opportunities: snapshot.opportunities,
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
