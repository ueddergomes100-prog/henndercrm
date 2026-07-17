/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync } = require("node:fs");
const { join } = require("node:path");

process.env.NODE_ENV = process.env.NODE_ENV === "development" ? "development" : "production";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = String(resolvePort());

const standaloneServer = join(__dirname, ".next", "standalone", "server.js");

if (!existsSync(standaloneServer)) {
  console.error("Hennder CRM standalone server not found. Run npm run build before npm run start.");
  process.exit(1);
}

require(standaloneServer);

function resolvePort() {
  const portFromEnv = Number(process.env.PORT);
  if (Number.isInteger(portFromEnv) && portFromEnv > 0) return portFromEnv;

  const portFlagIndex = process.argv.findIndex((arg) => arg === "-p" || arg === "--port");
  const portFromFlag = portFlagIndex >= 0 ? Number(process.argv[portFlagIndex + 1]) : NaN;
  if (Number.isInteger(portFromFlag) && portFromFlag > 0) return portFromFlag;

  const inlinePortArg = process.argv.find((arg) => arg.startsWith("--port="));
  const inlinePort = inlinePortArg ? Number(inlinePortArg.split("=")[1]) : NaN;
  if (Number.isInteger(inlinePort) && inlinePort > 0) return inlinePort;

  return 3000;
}
