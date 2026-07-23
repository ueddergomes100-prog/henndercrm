alter table public.crm_vendas_ignoradas
  drop constraint if exists crm_vendas_ignoradas_motivo_check;

alter table public.crm_vendas_ignoradas
  add constraint crm_vendas_ignoradas_motivo_check
  check (
    motivo in (
      'cliente_nao_identificado',
      'venda_cancelada',
      'venda_nao_faturada',
      'vendedor_nao_cadastrado',
      'item_sem_produto',
      'cliente_inativo',
      'dados_incompletos'
    )
  );
