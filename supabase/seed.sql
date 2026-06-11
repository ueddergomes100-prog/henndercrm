insert into public.crm_vendedores (
  id, uniplus_id, nome, email, celular, whatsapp, supervisor, perfil_id
) values
  ('00000000-0000-4000-8000-000000000201', 201, 'Carlos Mendes', 'carlos@agroplus.example', '(45) 99910-2001', '(45) 99910-2001', false, 3),
  ('00000000-0000-4000-8000-000000000202', 202, 'Mariana Costa', 'mariana@agroplus.example', '(45) 99910-2002', '(45) 99910-2002', false, 3),
  ('00000000-0000-4000-8000-000000000203', 203, 'Rafael Lima', 'rafael@agroplus.example', '(45) 99910-2003', '(45) 99910-2003', false, 3)
on conflict (uniplus_id) do update set
  nome = excluded.nome,
  email = excluded.email,
  celular = excluded.celular,
  whatsapp = excluded.whatsapp;

insert into public.crm_clientes (
  id, uniplus_id, codigo, nome, razao_social, cpf_cnpj, telefone, celular,
  whatsapp, email, endereco, bairro, cidade_id, estado_id, cep, data_cadastro,
  data_ultima_compra, categoria_cliente_id, classificacao_cliente_id, ciclo_compras
) values
  (
    '00000000-0000-4000-8000-000000000101', 101, 'CLI-0101', 'Agropecuária Vale Verde',
    'Vale Verde Insumos Agropecuários Ltda.', '12.345.678/0001-10', '(45) 3222-1103',
    '(45) 99821-1103', '(45) 99821-1103', 'compras@valeverde.example',
    'Avenida das Araucárias, 410', 'Centro', 4104808, 41, '85801-000',
    '2022-02-14', '2026-04-16', 1, 2, 45
  ),
  (
    '00000000-0000-4000-8000-000000000102', 102, 'CLI-0102', 'Pet Center Amigo Fiel',
    'Amigo Fiel Pet Center Ltda.', '23.456.789/0001-20', '(41) 3344-3021',
    '(41) 98744-3021', '(41) 98744-3021', 'contato@amigofiel.example',
    'Rua dos Animais, 82', 'Água Verde', 4106902, 41, '80240-010',
    '2023-05-08', '2026-05-24', 2, 1, 30
  ),
  (
    '00000000-0000-4000-8000-000000000103', 103, 'CLI-0103', 'Sítio Boa Safra',
    'João Ribeiro', '123.456.789-01', null, '(44) 99103-7762', '(44) 99103-7762', null,
    'Estrada Rural Boa Safra, km 12', 'Zona Rural', 4115200, 41, '87099-899',
    '2021-09-11', '2026-03-11', 1, 3, 60
  )
on conflict (uniplus_id) do update set
  nome = excluded.nome,
  data_ultima_compra = excluded.data_ultima_compra,
  ciclo_compras = excluded.ciclo_compras;

insert into public.crm_produtos (
  id, uniplus_id, codigo, nome, tipo, departamento, fornecedor, preco,
  tipo_produto, utiliza_crm, recompra_ativa, dias_recompra_padrao
) values
  ('00000000-0000-4000-8000-000000000301', 301, 'PET-RA-15', 'Ração Golden Gatos 15kg', 'Mercadoria', 'RAÇÃO', 'Premier Pet', 189.90, 'Revenda', true, true, 45),
  ('00000000-0000-4000-8000-000000000304', 304, 'AGR-HER-05', 'Herbicida Seletivo 5L', 'Mercadoria', 'DEFENSIVOS', 'Agro Química', 420.00, 'Revenda', true, true, 60),
  ('00000000-0000-4000-8000-000000000305', 305, 'AGR-OLE-01', 'Óleo 2 Tempos 1L', 'Mercadoria', 'MÁQUINAS', 'Moto Agro', 42.00, 'Revenda', true, true, 45),
  ('00000000-0000-4000-8000-000000000306', 306, 'AGR-VER-01', 'Vermífugo Bovino 1L', 'Mercadoria', 'VETERINÁRIA', 'Vet Campo', 178.00, 'Revenda', true, true, 90)
on conflict (uniplus_id) do update set
  nome = excluded.nome,
  preco = excluded.preco,
  recompra_ativa = excluded.recompra_ativa,
  dias_recompra_padrao = excluded.dias_recompra_padrao;

insert into public.crm_vendas (
  id, uniplus_id, cliente_id, vendedor_id, data_venda, data_inclusao,
  data_alteracao, valor_total, valor_desconto, status, aprovado
) values
  (
    '00000000-0000-4000-8000-000000000401', 401,
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    '2026-04-16', '2026-04-16 10:00:00-03', '2026-04-16 10:05:00-03',
    756.00, 20.00, 'FATURADO', true
  ),
  (
    '00000000-0000-4000-8000-000000000404', 404,
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000202',
    '2026-05-24', '2026-05-24 10:00:00-03', '2026-05-24 10:05:00-03',
    379.80, 0.00, 'FATURADO', true
  )
on conflict (uniplus_id) do update set
  data_alteracao = excluded.data_alteracao,
  valor_total = excluded.valor_total,
  status = excluded.status;

insert into public.crm_itens_venda (
  id, uniplus_id, venda_id, produto_id, codigo_produto, nome_produto,
  quantidade, valor_estimado
) values
  (
    '00000000-0000-4000-8000-000000000501', 501,
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000306',
    'AGR-VER-01', 'Vermífugo Bovino 1L', 4, 712.00
  ),
  (
    '00000000-0000-4000-8000-000000000504', 504,
    '00000000-0000-4000-8000-000000000404',
    '00000000-0000-4000-8000-000000000301',
    'PET-RA-15', 'Ração Golden Gatos 15kg', 2, 379.80
  )
on conflict (uniplus_id) do update set
  quantidade = excluded.quantidade,
  valor_estimado = excluded.valor_estimado;

insert into public.crm_regras_recompra (
  id, tipo_regra, produto_id, departamento, palavra_chave, dias_recompra,
  prioridade, ativo, observacao
) values
  ('00000000-0000-4000-8000-000000000601', 'produto', '00000000-0000-4000-8000-000000000305', null, null, 45, 120, true, 'Óleo 2T'),
  ('00000000-0000-4000-8000-000000000602', 'produto', '00000000-0000-4000-8000-000000000304', null, null, 60, 120, true, 'Herbicida'),
  ('00000000-0000-4000-8000-000000000603', 'departamento', null, 'RAÇÃO', null, 45, 60, true, 'Regra padrão para rações'),
  ('00000000-0000-4000-8000-000000000604', 'palavra_chave', null, null, 'VERMÍFUGO', 90, 100, true, 'Vermífugos')
on conflict (id) do update set
  dias_recompra = excluded.dias_recompra,
  prioridade = excluded.prioridade,
  ativo = excluded.ativo;

insert into public.crm_score_cliente (
  id, cliente_id, vendedor_preferencial_id, total_compras, valor_total_compras,
  ticket_medio, dias_sem_compra, frequencia_media_dias, score_recompra,
  score_relacionamento, score_cadastro, potencial_perdido, risco_perda
) values
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    3, 1556.00, 518.67, 56, 45, 91, 67, 100, 518.67, 'atencao'
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000202',
    3, 856.10, 285.37, 18, 30, 86, 100, 100, 0, 'ativo'
  )
on conflict (cliente_id) do update set
  total_compras = excluded.total_compras,
  valor_total_compras = excluded.valor_total_compras,
  ticket_medio = excluded.ticket_medio,
  dias_sem_compra = excluded.dias_sem_compra,
  score_recompra = excluded.score_recompra,
  potencial_perdido = excluded.potencial_perdido,
  risco_perda = excluded.risco_perda;
