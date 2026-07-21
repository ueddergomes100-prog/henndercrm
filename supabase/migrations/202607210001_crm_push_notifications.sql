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
  cliente_id uuid references public.crm_clientes(id) on delete cascade,
  vendedor_id uuid references public.crm_vendedores(id) on delete cascade,
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
  usuario_id uuid not null references public.crm_usuarios(id) on delete cascade,
  vendedor_id uuid references public.crm_vendedores(id) on delete cascade,
  lida_em timestamptz,
  limpa_em timestamptz,
  enviada_push_em timestamptz,
  erro_push text,
  created_at timestamptz not null default now(),
  unique (notificacao_id, usuario_id)
);

create table if not exists public.crm_push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.crm_usuarios(id) on delete cascade,
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

drop trigger if exists trg_crm_push_assinaturas_updated_at on public.crm_push_assinaturas;
create trigger trg_crm_push_assinaturas_updated_at before update on public.crm_push_assinaturas
for each row execute function public.crm_set_updated_at();

alter table public.crm_notificacoes enable row level security;
alter table public.crm_notificacao_destinatarios enable row level security;
alter table public.crm_push_assinaturas enable row level security;

drop policy if exists crm_notificacoes_leitura on public.crm_notificacoes;
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

drop policy if exists crm_notificacao_destinatarios_usuario on public.crm_notificacao_destinatarios;
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

drop policy if exists crm_push_assinaturas_usuario on public.crm_push_assinaturas;
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

comment on table public.crm_notificacoes is 'Eventos comerciais persistidos para sino e push do Hennder CRM.';
comment on table public.crm_notificacao_destinatarios is 'Estado individual por usuario: leitura, limpeza e envio push.';
comment on table public.crm_push_assinaturas is 'Assinaturas Web Push por aparelho/navegador autorizado.';
