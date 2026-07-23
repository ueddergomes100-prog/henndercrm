import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_RECONCILE_FROM = "2026-03-01";

const from =
  process.env.UNIPLUS_SYNC_RECONCILE_FROM?.trim() ||
  process.env.UNIPLUS_SYNC_START_DATE?.trim() ||
  DEFAULT_RECONCILE_FROM;
const to = process.env.UNIPLUS_SYNC_RECONCILE_TO?.trim() || tomorrowLocalDate();
const limit = process.env.UNIPLUS_SYNC_RECONCILE_BATCH_SIZE?.trim() || "100000";

const result = spawnSync(process.execPath, [
  "src/hennder-sync/agent.mjs",
  "--from",
  from,
  "--to",
  to,
  "--apply",
  "--cleanup-stale-sales",
  "--limit",
  limit,
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);

function tomorrowLocalDate() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
