import "server-only";

import type { CrmSnapshot } from "@/domain/crm/types";
import { SupabaseCrmSnapshotRepository } from "@/infrastructure/supabase/supabase-crm-snapshot-repository";

const SNAPSHOT_TTL_MS = 120_000;

let cachedSnapshot: { value: CrmSnapshot; expiresAt: number } | undefined;
let pendingSnapshot: Promise<CrmSnapshot> | undefined;
let cacheGeneration = 0;

export async function getCachedCrmSnapshot() {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.value;
  }
  if (pendingSnapshot) return pendingSnapshot;

  const requestGeneration = cacheGeneration;
  pendingSnapshot = new SupabaseCrmSnapshotRepository()
    .getSnapshot()
    .then((snapshot) => {
      if (requestGeneration === cacheGeneration) {
        cachedSnapshot = {
          value: snapshot,
          expiresAt: Date.now() + SNAPSHOT_TTL_MS,
        };
      }
      return snapshot;
    })
    .finally(() => {
      if (requestGeneration === cacheGeneration) {
        pendingSnapshot = undefined;
      }
    });

  return pendingSnapshot;
}

export function invalidateCrmSnapshotCache() {
  cacheGeneration += 1;
  cachedSnapshot = undefined;
  pendingSnapshot = undefined;
}
