/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("node:http");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

process.env.NODE_ENV = process.env.NODE_ENV === "development" ? "development" : "production";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = String(resolvePort());

const standaloneServer = join(__dirname, ".next", "standalone", "server.js");

if (existsSync(standaloneServer)) {
  console.log(`Hennder CRM starting standalone runtime on port ${process.env.PORT}.`);
  require(standaloneServer);
} else {
  console.warn("Hennder CRM standalone server not found. Falling back to Next runtime.");
  startFallbackNextServer();
}

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

function startFallbackNextServer() {
  const next = require("next");
  const port = Number(process.env.PORT);
  const hostname = process.env.HOSTNAME;
  const app = next({ dev: false, hostname, port });
  const handle = app.getRequestHandler();

  app
    .prepare()
    .then(() => {
      createServer((request, response) => {
        handle(request, response);
      }).listen(port, hostname, () => {
        console.log(`Hennder CRM fallback runtime ready on http://${hostname}:${port}`);
      });
    })
    .catch((error) => {
      console.error("Hennder CRM failed to start", error);
      process.exit(1);
    });
}
