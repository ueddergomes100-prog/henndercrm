import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.log("Standalone output not found; skipping asset copy.");
  process.exit(0);
}

await copyIfExists(join(root, "public"), join(standaloneDir, "public"));
await copyIfExists(join(root, ".next", "static"), join(standaloneDir, ".next", "static"));

async function copyIfExists(source, destination) {
  if (!existsSync(source)) return;
  await rm(destination, { force: true, recursive: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}
