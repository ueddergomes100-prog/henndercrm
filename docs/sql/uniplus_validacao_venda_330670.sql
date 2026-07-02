-- Hennder CRM - Validacao da venda 330670
--
-- Rode este SQL antes de exportar de novo.
-- Objetivo: confirmar qual campo contem o numero de venda visivel no Uniplus
-- e qual campo contem o vendedor comercial real.

-- 1) DAV por numero comercial e por ID interno.
SELECT
    d.codigo AS numero_venda_visivel,
    d.id AS dav_id_interno,
    d.datainclusao,
    d.dataalteracao,
    d.data,
    d.idcliente,
    d.nomecliente,
    d.valor,
    d.status,
    d.datacancelamento,

    d.idrepresentante AS representante_id,
    rep.codigo AS representante_codigo,
    rep.nome AS representante_nome,

    d.idrepresentante2 AS representante2_id,
    rep2.codigo AS representante2_codigo,
    rep2.nome AS representante2_nome,

    d.idusuario AS operador_usuario_id,
    u.nome AS operador_usuario_nome,

    d.idusuariofaturamento AS faturamento_usuario_id,
    uf.nome AS faturamento_usuario_nome
FROM dav d
LEFT JOIN entidade rep
    ON rep.id = d.idrepresentante
LEFT JOIN entidade rep2
    ON rep2.id = d.idrepresentante2
LEFT JOIN usuario u
    ON u.id = d.idusuario
LEFT JOIN usuario uf
    ON uf.id = d.idusuariofaturamento
WHERE d.codigo = 330670
   OR d.id = 330670
   OR d.id = 330777
ORDER BY d.codigo, d.id;

-- 2) Itens pelo relacionamento interno, mostrando tambem o codigodav do item.
SELECT
    d.codigo AS numero_venda_visivel,
    d.id AS dav_id_interno,
    di.id AS item_id,
    di.iddav AS item_dav_id_interno,
    di.codigodav AS item_numero_venda_visivel,
    di.idproduto,
    di.codigoproduto,
    di.nomeproduto,
    di.quantidade,
    di.preco,
    di.total
FROM dav d
INNER JOIN davitem di
    ON di.iddav = d.id
WHERE d.codigo = 330670
   OR d.id = 330670
   OR d.id = 330777
ORDER BY d.codigo, d.id, di.id;

-- 3) View de itens: conferir se documento/documento_unique tambem aponta para 330670.
SELECT
    v.documento,
    v.documento_unique,
    v.id AS venda_id_na_view,
    v.iditem,
    v.emissao,
    v.datahoraemissao,
    v.codigocliente,
    v.nomecliente,
    v.codigovendedor,
    v.nomevendedor,
    v.codigovendedor2,
    v.nomevendedor2,
    v.produto,
    v.quantidade,
    v.precounitario,
    v.total,
    v.valortotal,
    v.status
FROM vendas_itens_view v
WHERE v.documento = '330670'
   OR v.documento_unique = '330670'
   OR v.id = 330670
   OR v.id = 330777
   OR v.nomecliente ILIKE '%MARILENE MAGELA%'
ORDER BY v.documento, v.iditem;

-- 4) Cabecalho da view: conferir vendedor exibido no resumo.
SELECT
    c.documento,
    c.id AS venda_id_na_view,
    c.emissao,
    c.hora,
    c.codigocliente,
    c.cliente,
    c.vendedor,
    c.valorprodutos,
    c.valortotal,
    c.status
FROM vendas_cabecalho_view c
WHERE c.documento = '330670'
   OR c.id = 330670
   OR c.id = 330777
   OR c.cliente ILIKE '%MARILENE MAGELA%'
ORDER BY c.documento, c.id;
