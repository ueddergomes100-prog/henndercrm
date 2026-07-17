/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("node:http");
const next = require("next");

const dev = process.env.NODE_ENV === "development";
const hostname = "0.0.0.0";
const port = resolvePort();
const canonicalHost = "gestao.nexarcompany.com.br";
const redirectHosts = new Set(["nexarcompany.com.br", "www.nexarcompany.com.br"]);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((request, response) => {
      if (shouldRedirectToCanonicalHost(request)) {
        redirectToCanonicalHost(request, response);
        return;
      }

      handle(request, response);
    }).listen(port, hostname, () => {
      console.log(`Hennder CRM ready on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Hennder CRM failed to start", error);
    process.exit(1);
  });

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

function shouldRedirectToCanonicalHost(request) {
  const host = request.headers.host?.split(":")[0]?.toLowerCase();
  return redirectHosts.has(host);
}

function redirectToCanonicalHost(request, response) {
  const target = new URL(request.url || "/", `https://${canonicalHost}`);
  response.writeHead(308, {
    Location: target.toString(),
    "Cache-Control": "public, max-age=3600",
  });
  response.end();
}
