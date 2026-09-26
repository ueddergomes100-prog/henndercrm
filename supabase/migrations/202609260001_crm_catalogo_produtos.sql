create extension if not exists pg_trgm with schema extensions;

create table if not exists public.crm_catalogo_produtos (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint not null unique,
  codigo text,
  nome text not null,
  nome_busca text not null,
  estoque numeric(16, 3),
  preco_venda numeric(14, 2),
  inativo boolean not null default false,
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_catalogo_produtos_nome_busca_trgm_idx
  on public.crm_catalogo_produtos
  using gin (nome_busca extensions.gin_trgm_ops);

create index if not exists crm_catalogo_produtos_nome_idx
  on public.crm_catalogo_produtos (nome);

create index if not exists crm_catalogo_produtos_codigo_idx
  on public.crm_catalogo_produtos (codigo);

alter table public.crm_catalogo_produtos enable row level security;
