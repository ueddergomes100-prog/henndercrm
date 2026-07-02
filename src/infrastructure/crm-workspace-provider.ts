import "server-only";

import type { ICrmWorkspaceRepository } from "./crm-workspace-contract";
import { crmWorkspaceRepository } from "./crm-workspace-repository";
import { SupabaseCrmWorkspaceRepository } from "./supabase/supabase-crm-workspace-repository";

let supabaseRepository: SupabaseCrmWorkspaceRepository | undefined;

export function getCrmWorkspaceRepository(): ICrmWorkspaceRepository {
  if (
    process.env.CRM_OPERATIONAL_PROVIDER !== "supabase" ||
    process.env.CRM_DATA_PROVIDER === "mock"
  ) {
    return crmWorkspaceRepository;
  }
  supabaseRepository ??= new SupabaseCrmWorkspaceRepository();
  return supabaseRepository;
}
