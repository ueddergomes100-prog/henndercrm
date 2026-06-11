-- Uniplus must be accessed with a read-only database user.
-- For incremental synchronization, append the optional block at the end.

select
  d.id as uniplus_venda_id,
  d.data as data_venda,
  d.datainclusao,
  d.dataalteracao,
  d.idcliente as uniplus_cliente_id,
  d.nomecliente,
  d.cnpjcpfcliente,
  d.idusuario as uniplus_vendedor_id,
  u.nome as vendedor_nome,
  u.email as vendedor_email,
  u.celular as vendedor_celular,
  u.telefonewhatsapp as vendedor_whatsapp,
  d.valor as valor_venda,
  d.valordesconto,
  d.status,
  d.aprovado,
  d.datacancelamento,
  di.id as uniplus_item_id,
  di.iddav,
  di.idproduto as uniplus_produto_id,
  di.codigoproduto,
  di.nomeproduto,
  di.quantidade,
  p.codigo as produto_codigo,
  p.nome as produto_nome,
  p.tipo as produto_tipo,
  p.departamento as produto_departamento,
  p.idfabricante,
  p.preco as produto_preco,
  p.dataultimavenda,
  p.dataultimacompra,
  p.tipoproduto,
  p.utilizatacrm,
  e.nome as cliente_nome_cadastro,
  e.razaosocial,
  e.cnpjcpf,
  e.telefone,
  e.celular,
  e.whatsapp,
  e.email,
  e.endereco,
  e.bairro,
  e.idcidade,
  e.idestado,
  e.cep,
  e.datacadastro,
  e.dataultcompra,
  e.inativo,
  e.idcategoriacliente,
  e.idclassificacaocliente,
  e.ciclocompras
from dav d
left join davitem di on di.iddav = d.id
left join produto p on p.id = di.idproduto
left join usuario u on u.id = d.idusuario
left join entidade e on e.id = d.idcliente
where d.idcliente is not null
  and d.nomecliente is not null
  and trim(d.nomecliente) <> ''
  and d.datacancelamento is null;

-- Incremental block:
-- and (
--   d.dataalteracao >= :ultima_sincronizacao
--   or d.datainclusao >= :ultima_sincronizacao
--   or d.data >= :ultima_sincronizacao
-- )
