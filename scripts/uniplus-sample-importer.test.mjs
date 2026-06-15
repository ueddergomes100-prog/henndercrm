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
        cliente_cpf_cnpj: "123",
        cliente_celular: "33999999999",
        cliente_id_cidade: "2698",
        cliente_id_estado: "18",
        cliente_data_cadastro: "2020-01-01",
        cliente_inativo: "0",
        uniplus_vendedor_id: "30",
        vendedor_nome: "VENDEDOR REAL",
        vendedor_inativo: "0",
        uniplus_item_id: "40",
        uniplus_produto_id: "50",
        produto_codigo: "P50",
        produto_nome: "RAÇÃO DEMONSTRAÇÃO",
        produto_departamento: "1",
        produto_preco: "25.00",
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
      data_venda: "9540-01-01",
      venda_data_inclusao: "2026-05-10 12:00:00",
      venda_data_alteracao: "2026-05-11",
    }),
    "2026-05-10 12:00:00",
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

test("names are preserved while other personal fields remain pseudonymized", () => {
  const result = transformRows([row()], { referenceDate: "2026-06-15" });
  assert.equal(result.clients[0].name, "CLIENTE REAL CADASTRO");
  assert.equal(result.clients[0].legalName, "CLIENTE REAL RAZAO SOCIAL");
  assert.match(result.clients[0].document, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  assert.equal(result.clients[0].email, undefined);
  assert.equal(result.sellers[0].name, "VENDEDOR REAL");
});
