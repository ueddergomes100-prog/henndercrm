import type { CrmSnapshot } from "@/domain/crm/types";

export interface ICrmSnapshotRepository {
  getSnapshot(): Promise<CrmSnapshot>;
}
