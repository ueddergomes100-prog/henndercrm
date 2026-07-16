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

export type ManualCustomerInput = {
  name: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  category?: string;
  purchaseCycleDays?: number;
  sellerId?: string;
};

export type ManualCustomerResult = {
  id: string;
  uniplusId: number | null;
  name: string;
  phone: string;
  whatsapp: string;
  city: string;
  category: string;
  purchaseCycleDays: number;
  qualityScore: number;
  qualityStatus: "ruim" | "regular" | "bom" | "excelente";
  sellerId?: string;
  sellerName?: string;
};

export type CustomerContactUpdateInput = {
  customerId: string;
  phone: string;
  whatsapp: string;
};

export type CustomerContactUpdateResult = CustomerContactUpdateInput & {
  customerName?: string;
};

export interface ICrmWorkspaceRepository {
  getWorkspace(): Promise<CrmWorkspace>;
  createContact(input: Omit<CrmContactRecord, "id">): Promise<CrmContactRecord>;
  createManualCustomer(input: ManualCustomerInput): Promise<ManualCustomerResult>;
  createManualAlert(input: ManualRepurchaseAlertInput): Promise<CrmRepurchaseAlert>;
  updateCustomerContact(
    input: CustomerContactUpdateInput,
  ): Promise<CustomerContactUpdateResult>;
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
