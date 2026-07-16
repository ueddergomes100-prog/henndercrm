import type {
  CrmAgendaEvent,
  CrmContactRecord,
  CrmOpportunity,
  CrmRepurchaseAlert,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";

export type ManualRepurchaseAlertInput = {
  customerId: string;
  productName: string;
  recommendedIso: string;
  recurrenceDays: number;
  priority: CrmRepurchaseAlert["priority"];
  sellerId?: string;
  note?: string;
};

export interface ICrmWorkspaceRepository {
  getWorkspace(): Promise<CrmWorkspace>;
  createContact(input: Omit<CrmContactRecord, "id">): Promise<CrmContactRecord>;
  createManualAlert(input: ManualRepurchaseAlertInput): Promise<CrmRepurchaseAlert>;
  updateAlertStatus(
    id: string,
    status: RepurchaseAlertStatus,
  ): Promise<{ id: string; status: RepurchaseAlertStatus }>;
  createAgendaEvent(input: Omit<CrmAgendaEvent, "id">): Promise<CrmAgendaEvent>;
  updateAgendaEvent(
    id: string,
    values: Partial<Omit<CrmAgendaEvent, "id">>,
  ): Promise<CrmAgendaEvent>;
  deleteAgendaEvent(id: string): Promise<void>;
  createOpportunity(input: Omit<CrmOpportunity, "id">): Promise<CrmOpportunity>;
  updateOpportunity(
    id: string,
    values: Partial<Omit<CrmOpportunity, "id">>,
  ): Promise<CrmOpportunity>;
  deleteOpportunity(id: string): Promise<void>;
}
