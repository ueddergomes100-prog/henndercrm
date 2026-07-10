import "server-only";

import type { ICrmWorkspaceRepository } from "./crm-workspace-contract";
import { SupabaseCrmWorkspaceRepository } from "./supabase/supabase-crm-workspace-repository";

let supabaseRepository: SupabaseCrmWorkspaceRepository | undefined;

export function getCrmWorkspaceRepository(): ICrmWorkspaceRepository {
  supabaseRepository ??= new SupabaseCrmWorkspaceRepository();
  return supabaseRepository;
}
