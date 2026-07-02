-- Hennder CRM - Exportacao corrigida Uniplus
--
-- Motivo desta versao:
-- O SQL anterior usava:
--   d.id        AS uniplus_venda_id
--   d.idusuario AS uniplus_vendedor_id
--
-- Isso misturava conceitos:
--   d.id        = ID interno do registro DAV.
--   d.codigo    = numero comercial/visivel da venda no Uniplus.
--   d.idusuario = usuario/operador que lancou ou alterou a venda.
--
-- Para o CRM, a venda deve usar o numero comercial visivel:
--   d.codigo AS uniplus_venda_id
--
-- E o vendedor comercial deve usar representante:
--   d.idrepresentante -> entidade.id
--
-- Caso de validacao:
-- A venda da cliente Marilene era vista no Uniplus como 330670, mas o SQL
-- antigo exportou 330777 porque estava usando d.id. Com este SQL, esperamos
-- que uniplus_venda_id seja d.codigo.

SELECT
    -- VENDA - IDs separados para nao confundir numero comercial com ID interno
    d.codigo AS uniplus_venda_id,
    d.id AS uniplus_venda_internal_id,

    COALESCE(
        CASE
            WHEN d.data BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
            THEN d.data
            ELSE NULL
        END,
        CASE
            WHEN d.datainclusao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
            THEN d.datainclusao
            ELSE NULL
        END,
        CASE
            WHEN d.dataalteracao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
            THEN d.dataalteracao
            ELSE NULL
        END
    ) AS data_venda_final,

    CASE
        WHEN d.datainclusao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN d.datainclusao
        ELSE NULL
    END AS venda_data_inclusao,

    CASE
        WHEN d.dataalteracao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN d.dataalteracao
        ELSE NULL
    END AS venda_data_alteracao,

    d.valor AS valor_venda,
    d.valordesconto AS valor_desconto,
    d.status AS venda_status,
    d.aprovado AS venda_aprovada,
    d.datacancelamento AS venda_data_cancelamento,

    -- CLIENTE DA VENDA
    d.idcliente AS uniplus_cliente_id,
    d.nomecliente AS nome_cliente_venda,
    d.cnpjcpfcliente AS cpf_cnpj_cliente_venda,

    -- CADASTRO DO CLIENTE / ENTIDADE
    e.codigo AS cliente_codigo,
    e.nome AS cliente_nome_cadastro,
    e.razaosocial AS cliente_razao_social,
    e.cnpjcpf AS cliente_cpf_cnpj,
    e.telefone AS cliente_telefone,
    e.celular AS cliente_celular,
    e.whatsapp AS cliente_whatsapp,
    e.email AS cliente_email,
    e.endereco AS cliente_endereco,
    e.bairro AS cliente_bairro,
    e.idcidade AS cliente_id_cidade,
    e.idestado AS cliente_id_estado,
    e.cep AS cliente_cep,

    CASE
        WHEN e.datacadastro BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN e.datacadastro
        ELSE NULL
    END AS cliente_data_cadastro,

    CASE
        WHEN e.dataultcompra BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN e.dataultcompra
        ELSE NULL
    END AS cliente_data_ultima_compra,

    e.inativo AS cliente_inativo,
    e.idcategoriacliente AS cliente_categoria_id,
    e.idclassificacaocliente AS cliente_classificacao_id,
    e.ciclocompras AS cliente_ciclo_compras,

    -- QUALIDADE DO CADASTRO
    (
        CASE WHEN e.nome IS NOT NULL AND TRIM(e.nome) <> '' THEN 15 ELSE 0 END +
        CASE WHEN e.cnpjcpf IS NOT NULL AND TRIM(e.cnpjcpf) <> '' THEN 15 ELSE 0 END +
        CASE
            WHEN
                (e.telefone IS NOT NULL AND TRIM(e.telefone) <> '')
                OR (e.celular IS NOT NULL AND TRIM(e.celular) <> '')
            THEN 20 ELSE 0
        END +
        CASE WHEN e.whatsapp IS NOT NULL AND TRIM(e.whatsapp) <> '' THEN 20 ELSE 0 END +
        CASE WHEN e.email IS NOT NULL AND TRIM(e.email) <> '' THEN 10 ELSE 0 END +
        CASE WHEN e.idcidade IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN e.bairro IS NOT NULL AND TRIM(e.bairro) <> '' THEN 5 ELSE 0 END +
        CASE WHEN e.endereco IS NOT NULL AND TRIM(e.endereco) <> '' THEN 5 ELSE 0 END
    ) AS qualidade_cadastro_score,

    CASE
        WHEN (
            CASE WHEN e.nome IS NOT NULL AND TRIM(e.nome) <> '' THEN 15 ELSE 0 END +
            CASE WHEN e.cnpjcpf IS NOT NULL AND TRIM(e.cnpjcpf) <> '' THEN 15 ELSE 0 END +
            CASE WHEN (e.telefone IS NOT NULL AND TRIM(e.telefone) <> '') OR (e.celular IS NOT NULL AND TRIM(e.celular) <> '') THEN 20 ELSE 0 END +
            CASE WHEN e.whatsapp IS NOT NULL AND TRIM(e.whatsapp) <> '' THEN 20 ELSE 0 END +
            CASE WHEN e.email IS NOT NULL AND TRIM(e.email) <> '' THEN 10 ELSE 0 END +
            CASE WHEN e.idcidade IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN e.bairro IS NOT NULL AND TRIM(e.bairro) <> '' THEN 5 ELSE 0 END +
            CASE WHEN e.endereco IS NOT NULL AND TRIM(e.endereco) <> '' THEN 5 ELSE 0 END
        ) >= 90 THEN 'excelente'
        WHEN (
            CASE WHEN e.nome IS NOT NULL AND TRIM(e.nome) <> '' THEN 15 ELSE 0 END +
            CASE WHEN e.cnpjcpf IS NOT NULL AND TRIM(e.cnpjcpf) <> '' THEN 15 ELSE 0 END +
            CASE WHEN (e.telefone IS NOT NULL AND TRIM(e.telefone) <> '') OR (e.celular IS NOT NULL AND TRIM(e.celular) <> '') THEN 20 ELSE 0 END +
            CASE WHEN e.whatsapp IS NOT NULL AND TRIM(e.whatsapp) <> '' THEN 20 ELSE 0 END +
            CASE WHEN e.email IS NOT NULL AND TRIM(e.email) <> '' THEN 10 ELSE 0 END +
            CASE WHEN e.idcidade IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN e.bairro IS NOT NULL AND TRIM(e.bairro) <> '' THEN 5 ELSE 0 END +
            CASE WHEN e.endereco IS NOT NULL AND TRIM(e.endereco) <> '' THEN 5 ELSE 0 END
        ) >= 70 THEN 'bom'
        WHEN (
            CASE WHEN e.nome IS NOT NULL AND TRIM(e.nome) <> '' THEN 15 ELSE 0 END +
            CASE WHEN e.cnpjcpf IS NOT NULL AND TRIM(e.cnpjcpf) <> '' THEN 15 ELSE 0 END +
            CASE WHEN (e.telefone IS NOT NULL AND TRIM(e.telefone) <> '') OR (e.celular IS NOT NULL AND TRIM(e.celular) <> '') THEN 20 ELSE 0 END +
            CASE WHEN e.whatsapp IS NOT NULL AND TRIM(e.whatsapp) <> '' THEN 20 ELSE 0 END +
            CASE WHEN e.email IS NOT NULL AND TRIM(e.email) <> '' THEN 10 ELSE 0 END +
            CASE WHEN e.idcidade IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN e.bairro IS NOT NULL AND TRIM(e.bairro) <> '' THEN 5 ELSE 0 END +
            CASE WHEN e.endereco IS NOT NULL AND TRIM(e.endereco) <> '' THEN 5 ELSE 0 END
        ) >= 40 THEN 'regular'
        ELSE 'ruim'
    END AS qualidade_cadastro_status,

    -- VENDEDOR COMERCIAL
    -- Entidade representante e o vendedor/comissionado comercial.
    d.idrepresentante AS uniplus_vendedor_id,
    vr.codigo AS vendedor_codigo,
    vr.nome AS vendedor_nome,
    vr.email AS vendedor_email,
    vr.celular AS vendedor_celular,
    vr.whatsapp AS vendedor_whatsapp,
    vr.inativo AS vendedor_inativo,

    -- OPERADOR / USUARIO DO SISTEMA
    -- Mantido para auditoria, mas NAO deve ser usado como vendedor comercial.
    d.idusuario AS operador_usuario_id,
    u.nome AS operador_usuario_nome,
    d.idusuariofaturamento AS faturamento_usuario_id,
    uf.nome AS faturamento_usuario_nome,

    -- ITEM DA VENDA
    di.id AS uniplus_item_id,
    COALESCE(di.codigodav, d.codigo) AS item_uniplus_venda_id,
    di.iddav AS item_uniplus_venda_internal_id,
    di.idproduto AS uniplus_produto_id,
    di.codigoproduto AS produto_codigo_item,
    di.nomeproduto AS produto_nome_item,
    di.quantidade AS item_quantidade,

    CASE
        WHEN di.datainclusao BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN di.datainclusao
        ELSE NULL
    END AS item_data_inclusao,

    -- PRODUTO
    p.codigo AS produto_codigo,
    p.nome AS produto_nome,
    p.tipo AS produto_tipo,
    p.departamento AS produto_departamento,
    p.idfabricante AS produto_fabricante_id,
    p.preco AS produto_preco,

    CASE
        WHEN di.total IS NOT NULL THEN di.total
        WHEN di.preco IS NOT NULL AND di.quantidade IS NOT NULL THEN di.preco * di.quantidade
        WHEN p.preco IS NOT NULL AND di.quantidade IS NOT NULL THEN p.preco * di.quantidade
        ELSE NULL
    END AS item_valor_estimado,

    CASE
        WHEN p.dataultimavenda BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN p.dataultimavenda
        ELSE NULL
    END AS produto_data_ultima_venda,

    CASE
        WHEN p.dataultimacompra BETWEEN DATE '2000-01-01' AND CURRENT_DATE + INTERVAL '1 day'
        THEN p.dataultimacompra
        ELSE NULL
    END AS produto_data_ultima_compra,

    p.tipoproduto AS produto_tipo_produto,
    p.utilizacrm AS produto_utiliza_crm

FROM dav d

LEFT JOIN davitem di
    ON di.iddav = d.id

LEFT JOIN produto p
    ON p.id = di.idproduto

LEFT JOIN entidade e
    ON e.id = d.idcliente

LEFT JOIN entidade vr
    ON vr.id = d.idrepresentante

LEFT JOIN usuario u
    ON u.id = d.idusuario

LEFT JOIN usuario uf
    ON uf.id = d.idusuariofaturamento

WHERE d.codigo IS NOT NULL
  AND d.idcliente IS NOT NULL
  AND d.nomecliente IS NOT NULL
  AND TRIM(d.nomecliente) <> ''
  AND d.datacancelamento IS NULL

ORDER BY
    COALESCE(d.datainclusao, d.dataalteracao, d.data) DESC,
    d.codigo DESC,
    di.id ASC

LIMIT 5000;
