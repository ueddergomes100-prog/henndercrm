import assert from "node:assert/strict";
import test from "node:test";

import { resolveWhatsAppGreeting } from "../src/services/crm-whatsapp-message-service.ts";

test("seleciona a saudacao do WhatsApp conforme o horario", () => {
  assert.equal(resolveWhatsAppGreeting(new Date(2026, 6, 30, 8)), "Bom dia");
  assert.equal(resolveWhatsAppGreeting(new Date(2026, 6, 30, 12)), "Boa tarde");
  assert.equal(resolveWhatsAppGreeting(new Date(2026, 6, 30, 17, 59)), "Boa tarde");
  assert.equal(resolveWhatsAppGreeting(new Date(2026, 6, 30, 18)), "Boa noite");
});
