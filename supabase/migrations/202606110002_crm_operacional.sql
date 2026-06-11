create table if not exists public.crm_usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil text not null check (perfil in ('administrador', 'supervisor', 'vendedor')),
  vendedor_id uuid references public.crm_vendedores(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (perfil <> 'vendedor' or vendedor_id is not null)
);

create table if not exists public.crm_agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null check (tipo in ('Ligacao', 'Visita', 'Retorno', 'Recompra')),
  data_evento date not null,
  hora_evento time not null,
  cliente_id uuid references public.crm_clientes(id),
  vendedor_id uuid references public.crm_vendedores(id),
  concluido boolean not null default false,
  observacao text,
  created_by uuid references public.crm_usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_historico_contatos
  add column if not exists proximo_contato date,
  add column if not exists responsavel_nome text;

create index if not exists idx_crm_usuarios_auth on public.crm_usuarios(auth_user_id);
create index if not exists idx_crm_agenda_data on public.crm_agenda_eventos(data_evento, hora_evento);
create index if not exists idx_crm_agenda_vendedor on public.crm_agenda_eventos(vendedor_id);

drop trigger if exists trg_crm_usuarios_updated_at on public.crm_usuarios;
create trigger trg_crm_usuarios_updated_at before update on public.crm_usuarios
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_agenda_updated_at on public.crm_agenda_eventos;
create trigger trg_crm_agenda_updated_at before update on public.crm_agenda_eventos
for each row execute function public.crm_set_updated_at();

create or replace function public.crm_usuario_perfil()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select perfil
  from public.crm_usuarios
  where auth_user_id = auth.uid() and ativo = true
  limit 1;
$$;

create or replace function public.crm_usuario_vendedor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select vendedor_id
  from public.crm_usuarios
  where auth_user_id = auth.uid() and ativo = true
  limit 1;
$$;

alter table public.crm_usuarios enable row level security;
alter table public.crm_agenda_eventos enable row level security;

drop policy if exists crm_usuarios_leitura on public.crm_usuarios;
create policy crm_usuarios_leitura on public.crm_usuarios
for select to authenticated
using (
  auth_user_id = auth.uid()
  or public.crm_usuario_perfil() in ('administrador', 'supervisor')
);

drop policy if exists crm_agenda_leitura on public.crm_agenda_eventos;
create policy crm_agenda_leitura on public.crm_agenda_eventos
for select to authenticated
using (
  public.crm_usuario_perfil() in ('administrador', 'supervisor')
  or vendedor_id = public.crm_usuario_vendedor_id()
);

drop policy if exists crm_agenda_escrita on public.crm_agenda_eventos;
create policy crm_agenda_escrita on public.crm_agenda_eventos
for all to authenticated
using (
  public.crm_usuario_perfil() in ('administrador', 'supervisor')
  or vendedor_id = public.crm_usuario_vendedor_id()
)
with check (
  public.crm_usuario_perfil() in ('administrador', 'supervisor')
  or vendedor_id = public.crm_usuario_vendedor_id()
);

comment on table public.crm_usuarios is 'Perfil operacional vinculado ao Supabase Auth.';
comment on table public.crm_agenda_eventos is 'Tarefas e compromissos editaveis do CRM.';
