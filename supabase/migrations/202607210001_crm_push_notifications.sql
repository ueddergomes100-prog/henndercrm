create extension if not exists pgcrypto;

create table if not exists public.crm_notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (
    tipo in (
      'retorno_hoje',
      'retorno_atrasado',
      'recompra_hoje',
      'recompra_atrasada',
      'agenda_hoje',
      'alerta_manual',
      'venda_recuperada',
      'resumo_diario',
      'sync_erro',
      'teste'
    )
  ),
  titulo text not null,
  descricao text not null,
  tom text not null default 'cyan' check (tom in ('red', 'amber', 'cyan', 'emerald')),
  destino_view text,
  cliente_id uuid,
  vendedor_id uuid,
  entidade_tipo text,
  entidade_id text,
  dedupe_key text not null unique,
  disponivel_em timestamptz not null default now(),
  expira_em timestamptz,
  enviar_push boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_notificacao_destinatarios (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.crm_notificacoes(id) on delete cascade,
  usuario_id uuid not null,
  vendedor_id uuid,
  lida_em timestamptz,
  limpa_em timestamptz,
  enviada_push_em timestamptz,
  erro_push text,
  created_at timestamptz not null default now(),
  unique (notificacao_id, usuario_id)
);

create table if not exists public.crm_push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_notificacoes_disponivel
  on public.crm_notificacoes(disponivel_em desc);

create index if not exists idx_crm_notificacoes_dedupe
  on public.crm_notificacoes(dedupe_key);

create index if not exists idx_crm_notificacao_dest_usuario
  on public.crm_notificacao_destinatarios(usuario_id, limpa_em, created_at desc);

create index if not exists idx_crm_push_assinaturas_usuario
  on public.crm_push_assinaturas(usuario_id, ativo);

do $$
begin
  if to_regprocedure('public.crm_set_updated_at()') is not null then
    drop trigger if exists trg_crm_push_assinaturas_updated_at on public.crm_push_assinaturas;
    create trigger trg_crm_push_assinaturas_updated_at before update on public.crm_push_assinaturas
    for each row execute function public.crm_set_updated_at();
  end if;
end $$;

do $$
begin
  if to_regclass('public.crm_clientes') is not null then
    alter table public.crm_notificacoes
      drop constraint if exists crm_notificacoes_cliente_id_fkey,
      add constraint crm_notificacoes_cliente_id_fkey
        foreign key (cliente_id) references public.crm_clientes(id) on delete cascade;
  end if;

  if to_regclass('public.crm_vendedores') is not null then
    alter table public.crm_notificacoes
      drop constraint if exists crm_notificacoes_vendedor_id_fkey,
      add constraint crm_notificacoes_vendedor_id_fkey
        foreign key (vendedor_id) references public.crm_vendedores(id) on delete cascade;

    alter table public.crm_notificacao_destinatarios
      drop constraint if exists crm_notificacao_destinatarios_vendedor_id_fkey,
      add constraint crm_notificacao_destinatarios_vendedor_id_fkey
        foreign key (vendedor_id) references public.crm_vendedores(id) on delete cascade;
  end if;

  if to_regclass('public.crm_usuarios') is not null then
    alter table public.crm_notificacao_destinatarios
      drop constraint if exists crm_notificacao_destinatarios_usuario_id_fkey,
      add constraint crm_notificacao_destinatarios_usuario_id_fkey
        foreign key (usuario_id) references public.crm_usuarios(id) on delete cascade;

    alter table public.crm_push_assinaturas
      drop constraint if exists crm_push_assinaturas_usuario_id_fkey,
      add constraint crm_push_assinaturas_usuario_id_fkey
        foreign key (usuario_id) references public.crm_usuarios(id) on delete cascade;
  end if;
end $$;

alter table public.crm_notificacoes enable row level security;
alter table public.crm_notificacao_destinatarios enable row level security;
alter table public.crm_push_assinaturas enable row level security;

drop policy if exists crm_notificacoes_leitura on public.crm_notificacoes;
do $$
begin
  if to_regclass('public.crm_usuarios') is not null then
    create policy crm_notificacoes_leitura on public.crm_notificacoes
    for select to authenticated
    using (
      exists (
        select 1
        from public.crm_notificacao_destinatarios d
        join public.crm_usuarios u on u.id = d.usuario_id
        where d.notificacao_id = crm_notificacoes.id
          and u.auth_user_id = auth.uid()
          and u.ativo = true
      )
    );
  end if;
end $$;

drop policy if exists crm_notificacao_destinatarios_usuario on public.crm_notificacao_destinatarios;
do $$
begin
  if to_regclass('public.crm_usuarios') is not null then
    create policy crm_notificacao_destinatarios_usuario on public.crm_notificacao_destinatarios
    for all to authenticated
    using (
      exists (
        select 1
        from public.crm_usuarios u
        where u.id = usuario_id
          and u.auth_user_id = auth.uid()
          and u.ativo = true
      )
    )
    with check (
      exists (
        select 1
        from public.crm_usuarios u
        where u.id = usuario_id
          and u.auth_user_id = auth.uid()
          and u.ativo = true
      )
    );
  end if;
end $$;

drop policy if exists crm_push_assinaturas_usuario on public.crm_push_assinaturas;
do $$
begin
  if to_regclass('public.crm_usuarios') is not null then
    create policy crm_push_assinaturas_usuario on public.crm_push_assinaturas
    for all to authenticated
    using (
      exists (
        select 1
        from public.crm_usuarios u
        where u.id = usuario_id
          and u.auth_user_id = auth.uid()
          and u.ativo = true
      )
    )
    with check (
      exists (
        select 1
        from public.crm_usuarios u
        where u.id = usuario_id
          and u.auth_user_id = auth.uid()
          and u.ativo = true
      )
    );
  end if;
end $$;

comment on table public.crm_notificacoes is 'Eventos comerciais persistidos para sino e push do Hennder CRM.';
comment on table public.crm_notificacao_destinatarios is 'Estado individual por usuario: leitura, limpeza e envio push.';
comment on table public.crm_push_assinaturas is 'Assinaturas Web Push por aparelho/navegador autorizado.';
