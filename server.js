const { createServer } = require("node:http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((request, response) => {
    handle(request, response);
  }).listen(port, hostname, () => {
    console.log(`Hennder CRM ready on http://${hostname}:${port}`);
  });
});
