import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCsv,
  resolveSaleDate,
  sanitizeDate,
  transformRows,
} from "./uniplus-sample-importer.mjs";

const headers = [
  "uniplus_venda_id",
  "data_venda_final",
  "data_venda",
  "venda_data_inclusao",
  "venda_data_alteracao",
  "valor_venda",
  "valor_desconto",
  "venda_status",
  "venda_aprovada",
  "uniplus_cliente_id",
  "nome_cliente_venda",
  "cliente_codigo",
  "cliente_nome_cadastro",
  "cliente_razao_social",
  "cliente_cpf_cnpj",
  "cliente_telefone",
  "cliente_celular",
  "cliente_whatsapp",
  "cliente_email",
  "cliente_endereco",
  "cliente_bairro",
  "cliente_id_cidade",
  "cliente_id_estado",
  "cliente_cep",
  "cliente_data_cadastro",
  "cliente_data_ultima_compra",
  "cliente_inativo",
  "cliente_categoria_id",
  "cliente_classificacao_id",
  "cliente_ciclo_compras",
  "uniplus_vendedor_id",
  "vendedor_nome",
  "vendedor_email",
  "vendedor_celular",
  "vendedor_whatsapp",
  "vendedor_supervisor",
  "vendedor_inativo",
  "vendedor_perfil_id",
  "uniplus_item_id",
  "item_uniplus_venda_id",
  "uniplus_produto_id",
  "produto_codigo_item",
  "produto_nome_item",
  "item_quantidade",
  "item_data_inclusao",
  "produto_codigo",
  "produto_nome",
  "produto_tipo",
  "produto_departamento",
  "produto_fabricante_id",
  "produto_preco",
  "item_valor_estimado",
  "produto_data_ultima_venda",
  "produto_data_ultima_compra",
  "produto_tipo_produto",
  "produto_utiliza_crm",
];

function row(overrides = {}) {
  return Object.fromEntries(
    headers.map((header) => {
      const defaults = {
        uniplus_venda_id: "10",
        data_venda_final: "NULL",
        data_venda: "NULL",
        venda_data_inclusao: "2026-06-12 10:00:00",
        venda_data_alteracao: "2026-06-12 10:05:00",
        valor_venda: "100.00",
        valor_desconto: "0",
        venda_status: "2",
        venda_aprovada: "0",
        uniplus_cliente_id: "20",
        nome_cliente_venda: "CLIENTE REAL DA VENDA",
        cliente_codigo: "C20",
        cliente_nome_cadastro: "CLIENTE REAL CADASTRO",
        cliente_razao_social: "CLIENTE REAL RAZAO SOCIAL",
        cliente_cpf_cnpj: "123.456.789-00",
        cliente_telefone: "3333333333",
        cliente_celular: "33999999999",
        cliente_whatsapp: "33888888888",
        cliente_email: "cliente@exemplo.com",
        cliente_endereco: "RUA REAL",
        cliente_bairro: "CENTRO",
        cliente_cep: "36900-000",
        cliente_id_cidade: "2698",
        cliente_id_estado: "18",
        cliente_data_cadastro: "2020-01-01",
        cliente_inativo: "0",
        uniplus_vendedor_id: "30",
        vendedor_nome: "VENDEDOR REAL",
        vendedor_email: "vendedor@exemplo.com",
        vendedor_celular: "33977777777",
        vendedor_whatsapp: "33966666666",
        vendedor_inativo: "0",
        uniplus_item_id: "40",
        item_uniplus_venda_id: "10",
        uniplus_produto_id: "50",
        produto_codigo: "P50",
        produto_nome: "RAÇÃO DEMONSTRAÇÃO",
        produto_departamento: "1",
        produto_preco: "25.00",
        item_valor_estimado: "50.00",
        item_quantidade: "2",
        item_data_inclusao: "2026-06-12",
      };
      return [header, overrides[header] ?? defaults[header] ?? ""];
    }),
  );
}

test("parseCsv preserves commas and escaped quotes", () => {
  const rows = parseCsv('"id","name"\n"1","Produto, ""Especial"""\n');
  assert.deepEqual(rows, [{ id: "1", name: 'Produto, "Especial"' }]);
});

test("invalid years become null and sale date uses fallbacks", () => {
  assert.equal(sanitizeDate("9540-01-01"), null);
  assert.equal(
    resolveSaleDate({
      data_venda_final: "9540-01-01",
      data_venda: "9540-01-01",
      venda_data_inclusao: "2026-05-10 12:00:00",
      venda_data_alteracao: "2026-05-11",
    }),
    "2026-05-10 12:00:00",
  );
  assert.equal(
    resolveSaleDate({
      data_venda_final: "2026-06-23 00:00:00",
      data_venda: "2026-05-10",
    }),
    "2026-06-23 00:00:00",
  );
});

test("one sale with multiple item ids creates one sale and many items", () => {
  const result = transformRows(
    [
      row(),
      row({ uniplus_item_id: "41", uniplus_produto_id: "51", produto_codigo: "P51" }),
      row({ uniplus_item_id: "42", uniplus_produto_id: "52", produto_codigo: "P52" }),
    ],
    { referenceDate: "2026-06-15" },
  );

  assert.equal(result.sales.length, 1);
  assert.equal(result.items.length, 3);
  assert.equal(result.items.every((item) => item.saleId === 10), true);
  assert.equal(result.metadata.multiItemSales, 1);
  assert.equal(result.metadata.maxItemsPerSale, 3);
});

test("item rows linked to a different sale are rejected", () => {
  const result = transformRows(
    [
      row(),
      row({
        uniplus_item_id: "41",
        item_uniplus_venda_id: "999",
      }),
    ],
    { referenceDate: "2026-06-15" },
  );

  assert.equal(result.sales.length, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.metadata.invalidRows.length, 1);
  assert.equal(result.metadata.invalidRows[0].reason, "item_vinculado_a_outra_venda");
});

test("names and personal fields from SQL are preserved", () => {
  const result = transformRows([row()], { referenceDate: "2026-06-15" });
  assert.equal(result.clients[0].name, "CLIENTE REAL CADASTRO");
  assert.equal(result.clients[0].legalName, "CLIENTE REAL RAZAO SOCIAL");
  assert.equal(result.clients[0].document, "123.456.789-00");
  assert.equal(result.clients[0].phone, "3333333333");
  assert.equal(result.clients[0].mobile, "33999999999");
  assert.equal(result.clients[0].whatsapp, result.clients[0].mobile);
  assert.equal(result.clients[0].email, "cliente@exemplo.com");
  assert.equal(result.clients[0].address, "RUA REAL");
  assert.equal(result.clients[0].zipCode, "36900-000");
  assert.equal(result.sellers[0].name, "VENDEDOR REAL");
  assert.equal(result.sellers[0].email, "vendedor@exemplo.com");
  assert.equal(result.items[0].estimatedValue, 50);
});

test("customer WhatsApp availability uses mobile before the dedicated field", () => {
  const mobileResult = transformRows(
    [row({ cliente_celular: "33999999999", cliente_whatsapp: "33888888888" })],
    { referenceDate: "2026-06-15" },
  );
  assert.equal(mobileResult.clients[0].whatsapp, mobileResult.clients[0].mobile);

  const whatsappResult = transformRows(
    [row({ cliente_celular: "", cliente_whatsapp: "33888888888" })],
    { referenceDate: "2026-06-15" },
  );
  assert.equal(whatsappResult.clients[0].whatsapp, "33888888888");
  assert.equal(whatsappResult.clients[0].mobile, undefined);
});
