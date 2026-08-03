import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCrmAttributionSummary,
  CRM_ATTRIBUTION_MAX_DAYS,
} from "../src/services/crm-attribution-service.ts";

const customer = {
  id: "customer-1",
  name: "Cliente Teste",
  preferredSeller: "Daniel Bahia",
};

function sale(id, soldAt, totalValue = 100) {
  return {
    id,
    customerId: customer.id,
    sellerId: "seller-1",
    soldAt,
    totalValue,
    approved: true,
  };
}

function contact(id, contactedAt, outcome = "no_answer") {
  return {
    id,
    customerId: customer.id,
    customerName: customer.name,
    outcome,
    note: "Contato comercial",
    nextContact: "",
    contactedAt,
    channel: "WhatsApp",
    responsible: "Daniel Bahia",
    sellerId: "seller-1",
  };
}

test("separa compra posterior a 30 dias como receita de relacionamento", () => {
  const summary = buildCrmAttributionSummary({
    customers: [customer],
    sales: [
      sale("sale-day-30", "2026-07-31T12:00:00Z", 200),
      sale("sale-day-31", "2026-08-01T12:00:00Z", 300),
    ],
    contactRecords: [contact("contact-1", "2026-07-01T09:00:00Z")],
  });

  assert.equal(CRM_ATTRIBUTION_MAX_DAYS, 30);
  assert.equal(summary.attributedSales.length, 1);
  assert.equal(summary.attributedSales[0].sale.id, "sale-day-30");
  assert.equal(summary.attributedSales[0].window.id, "influenced_30");
  assert.equal(summary.relationshipSales.length, 1);
  assert.equal(summary.relationshipSales[0].sale.id, "sale-day-31");
  assert.equal(summary.relationshipRevenue, 300);
  assert.equal(summary.trackedSales.length, 2);
  assert.equal(summary.totalAttributedRevenue, 100);
});

test("recorta o resultado pelo mes da venda sem perder o contato historico", () => {
  const summary = buildCrmAttributionSummary({
    customers: [customer],
    sales: [
      sale("sale-july", "2026-07-31T12:00:00Z", 200),
      sale("sale-august", "2026-08-02T12:00:00Z", 300),
    ],
    contactRecords: [contact("contact-1", "2026-07-31T09:00:00Z")],
    saleMonth: "2026-08",
  });

  assert.equal(summary.trackedSales.length, 1);
  assert.equal(summary.trackedSales[0].sale.id, "sale-august");
  assert.equal(summary.recoveredRevenue, 300);
  assert.equal(summary.contactedCustomers, 1);
  assert.equal(summary.convertedCustomers, 1);
});

test("uma venda entra uma unica vez mesmo com varios contatos", () => {
  const summary = buildCrmAttributionSummary({
    customers: [customer],
    sales: [sale("sale-1", "2026-07-25T12:00:00Z", 500)],
    contactRecords: [
      contact("contact-1", "2026-07-01T09:00:00Z"),
      contact("contact-2", "2026-07-20T09:00:00Z"),
    ],
  });

  assert.equal(summary.attributedSales.length, 1);
  assert.equal(summary.attributedSales[0].contact.id, "contact-2");
  assert.equal(summary.totalAttributedRevenue, 500);
});
