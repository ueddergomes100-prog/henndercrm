-- Hennder CRM - Diagnostico de vendedor e itens no Uniplus
--
-- Objetivo:
-- 1. Descobrir qual coluna/tabela representa o vendedor comercial real.
-- 2. Separar vendedor de operador/usuario que lancou ou alterou a venda.
-- 3. Confirmar que os itens estao vinculados a venda correta.
--
-- Use primeiro as vendas 330670 e 330777.
-- O caso conhecido e:
-- - no ERP, a venda correta da cliente Marilene e 330670;
-- - no SQL atual, os itens/cliente apareceram como 330777;
-- - d.idusuario trouxe "Taiene", mas esse nao parece ser o vendedor real.

-- IMPORTANTE:
-- O SQL atual usa d.id AS uniplus_venda_id. Se o numero correto visivel
-- no Uniplus for 330670, e nao 330777, entao d.id pode nao ser o numero
-- comercial da venda/pedido que deve aparecer no CRM.

-- 1) Colunas candidatas na tabela de venda/pedido.
SELECT
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND table_name IN ('dav', 'davitem')
  AND (
      lower(column_name) LIKE '%vend%'
      OR lower(column_name) LIKE '%vendedor%'
      OR lower(column_name) LIKE '%usuario%'
      OR lower(column_name) LIKE '%user%'
      OR lower(column_name) LIKE '%oper%'
      OR lower(column_name) LIKE '%atend%'
      OR lower(column_name) LIKE '%repres%'
      OR lower(column_name) LIKE '%func%'
      OR lower(column_name) LIKE '%comiss%'
      OR lower(column_name) LIKE '%num%'
      OR lower(column_name) LIKE '%doc%'
      OR lower(column_name) LIKE '%pedido%'
      OR lower(column_name) LIKE '%venda%'
  )
ORDER BY table_name, column_name;

-- 2) Comparar 330670 x 330777 usando d.id.
SELECT
    d.id AS venda_id,
    d.data AS data_venda,
    d.datainclusao AS venda_data_inclusao,
    d.dataalteracao AS venda_data_alteracao,
    d.idcliente,
    d.nomecliente,
    d.valor,
    d.status,
    d.aprovado,
    d.datacancelamento,
    d.idusuario AS idusuario_lancamento_ou_operador,
    u.nome AS usuario_lancamento_ou_operador_nome,
    u.supervisor AS usuario_supervisor,
    u.inativo AS usuario_inativo
FROM dav d
LEFT JOIN usuario u
    ON u.id = d.idusuario
WHERE d.id IN (330670, 330777)
ORDER BY d.id;

-- 2.1) Ver todas as colunas da DAV para 330670 e 330777.
-- Rode esta consulta no pgAdmin/DBeaver e compare colunas como numero,
-- iddav, iddocumento, idpedido, idvenda, idusuario, vendedor, operador etc.
SELECT *
FROM dav d
WHERE d.id IN (330670, 330777)
ORDER BY d.id;

-- 3) Itens das duas vendas: conferir onde estao os produtos da Marilene.
SELECT
    di.id AS item_id,
    di.iddav AS item_venda_id,
    di.idproduto,
    di.codigoproduto,
    di.nomeproduto,
    di.quantidade,
    di.datainclusao AS item_data_inclusao
FROM davitem di
WHERE di.iddav IN (330670, 330777)
ORDER BY di.iddav, di.id;

-- 3.1) Ver todas as colunas dos itens de 330670 e 330777.
-- Isso ajuda a descobrir se existe outro campo de vinculo/numero da venda.
SELECT *
FROM davitem di
WHERE di.iddav IN (330670, 330777)
ORDER BY di.iddav, di.id;

-- 4) Itens suspeitos no periodo: item cujo iddav nao bate com a venda do resultado.
-- Se esta consulta voltar linhas quando adaptada ao SQL final, a extracao esta cruzando itens.
SELECT
    d.id AS venda_id,
    di.id AS item_id,
    di.iddav AS item_venda_id,
    d.nomecliente,
    di.nomeproduto
FROM dav d
JOIN davitem di
    ON di.iddav = d.id
WHERE d.datainclusao::date BETWEEN DATE '2026-06-20' AND DATE '2026-06-23'
  AND di.iddav <> d.id
ORDER BY d.id, di.id;

-- 5) Amostra para comparar vendas conhecidas manualmente.
-- Troque/adicone IDs que voce sabe qual vendedor deveria aparecer.
SELECT
    d.id AS venda_id,
    d.datainclusao,
    d.nomecliente,
    d.valor,
    d.idusuario AS idusuario_lancamento_ou_operador,
    u.nome AS usuario_lancamento_ou_operador_nome,
    COUNT(di.id) AS qtd_itens
FROM dav d
LEFT JOIN usuario u
    ON u.id = d.idusuario
LEFT JOIN davitem di
    ON di.iddav = d.id
WHERE d.id IN (330670, 330777)
GROUP BY
    d.id,
    d.datainclusao,
    d.nomecliente,
    d.valor,
    d.idusuario,
    u.nome
ORDER BY d.id;

-- 6) Quando identificar a coluna correta do vendedor comercial:
-- - substitua o alias uniplus_vendedor_id no SQL principal por essa coluna;
-- - substitua vendedor_nome pelo nome vindo da tabela correta;
-- - mantenha d.idusuario separado como operador/usuario_lancamento, nao como vendedor.
