create extension if not exists pgcrypto;

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.crm_clientes (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint unique,
  codigo text,
  nome text not null,
  razao_social text,
  cpf_cnpj text,
  telefone text,
  celular text,
  whatsapp text,
  email text,
  endereco text,
  bairro text,
  cidade_id bigint,
  estado_id bigint,
  cep text,
  data_cadastro timestamptz,
  data_ultima_compra timestamptz,
  inativo boolean not null default false,
  categoria_cliente_id bigint,
  classificacao_cliente_id bigint,
  ciclo_compras integer,
  qualidade_cadastro_score integer not null default 0 check (qualidade_cadastro_score between 0 and 100),
  qualidade_cadastro_status text check (
    qualidade_cadastro_status is null
    or qualidade_cadastro_status in ('ruim', 'regular', 'bom', 'excelente')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_vendedores (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint unique,
  nome text not null,
  email text,
  celular text,
  whatsapp text,
  supervisor boolean not null default false,
  inativo boolean not null default false,
  perfil_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_produtos (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint unique,
  codigo text,
  nome text not null,
  tipo text,
  departamento text,
  fabricante_id bigint,
  fornecedor text,
  preco numeric(14, 2),
  data_ultima_venda timestamptz,
  data_ultima_compra timestamptz,
  tipo_produto text,
  utiliza_crm boolean not null default false,
  recompra_ativa boolean not null default false,
  dias_recompra_padrao integer check (dias_recompra_padrao is null or dias_recompra_padrao > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_vendas (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint unique,
  cliente_id uuid not null references public.crm_clientes(id),
  vendedor_id uuid references public.crm_vendedores(id),
  data_venda timestamptz not null,
  data_inclusao timestamptz,
  data_alteracao timestamptz,
  valor_total numeric(14, 2) not null default 0,
  valor_desconto numeric(14, 2) not null default 0,
  status text,
  aprovado boolean,
  cancelada boolean not null default false,
  data_cancelamento timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_itens_venda (
  id uuid primary key default gen_random_uuid(),
  uniplus_id bigint unique,
  venda_id uuid not null references public.crm_vendas(id) on delete cascade,
  produto_id uuid not null references public.crm_produtos(id),
  codigo_produto text,
  nome_produto text not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  valor_estimado numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_regras_recompra (
  id uuid primary key default gen_random_uuid(),
  tipo_regra text not null check (
    tipo_regra in ('produto', 'departamento', 'palavra_chave', 'manual_cliente_produto')
  ),
  produto_id uuid references public.crm_produtos(id),
  departamento text,
  palavra_chave text,
  dias_recompra integer not null check (dias_recompra > 0),
  prioridade integer not null default 1,
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tipo_regra = 'produto' and produto_id is not null)
    or (tipo_regra = 'departamento' and departamento is not null)
    or (tipo_regra = 'palavra_chave' and palavra_chave is not null)
    or tipo_regra = 'manual_cliente_produto'
  )
);

create table if not exists public.crm_alertas_recompra (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crm_clientes(id),
  produto_id uuid not null references public.crm_produtos(id),
  venda_id uuid not null references public.crm_vendas(id),
  item_venda_id uuid not null references public.crm_itens_venda(id),
  vendedor_responsavel_id uuid references public.crm_vendedores(id),
  data_compra timestamptz not null,
  data_prevista_recompra date not null,
  dias_recompra integer not null check (dias_recompra > 0),
  status text not null default 'pendente' check (
    status in ('pendente', 'contatado', 'convertido', 'perdido', 'ignorado')
  ),
  prioridade text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  origem text not null check (
    origem in ('regra_produto', 'regra_departamento', 'historico_cliente', 'manual', 'ia')
  ),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, produto_id, venda_id, item_venda_id)
);

create table if not exists public.crm_historico_contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crm_clientes(id),
  vendedor_id uuid references public.crm_vendedores(id),
  alerta_id uuid references public.crm_alertas_recompra(id),
  tipo_contato text not null check (
    tipo_contato in ('whatsapp', 'telefone', 'visita', 'presencial', 'email')
  ),
  data_contato timestamptz not null default now(),
  mensagem text,
  resultado text check (
    resultado is null
    or resultado in ('sem_resposta', 'interessado', 'comprou', 'nao_interessado', 'atualizar_cadastro', 'remarcar')
  ),
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crm_clientes(id),
  venda_id uuid references public.crm_vendas(id),
  produto_origem_id uuid references public.crm_produtos(id),
  produto_sugerido_nome text not null,
  motivo text,
  confianca integer check (confianca between 0 and 100),
  status text not null default 'aberta' check (
    status in ('aberta', 'em_contato', 'convertida', 'descartada')
  ),
  vendedor_responsavel_id uuid references public.crm_vendedores(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_score_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.crm_clientes(id) on delete cascade,
  vendedor_preferencial_id uuid references public.crm_vendedores(id),
  total_compras integer not null default 0,
  valor_total_compras numeric(14, 2) not null default 0,
  ticket_medio numeric(14, 2) not null default 0,
  dias_sem_compra integer,
  frequencia_media_dias numeric(10, 2),
  score_recompra integer not null default 0 check (score_recompra between 0 and 100),
  score_relacionamento integer not null default 0 check (score_relacionamento between 0 and 100),
  score_cadastro integer not null default 0 check (score_cadastro between 0 and 100),
  potencial_perdido numeric(14, 2) not null default 0,
  risco_perda text check (
    risco_perda is null or risco_perda in ('ativo', 'atencao', 'risco', 'perdido')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_vendas_ignoradas (
  id uuid primary key default gen_random_uuid(),
  uniplus_venda_id bigint,
  motivo text not null check (
    motivo in (
      'cliente_nao_identificado',
      'venda_cancelada',
      'item_sem_produto',
      'cliente_inativo',
      'dados_incompletos'
    )
  ),
  dados jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  status text not null check (status in ('iniciada', 'concluida', 'erro')),
  inicio timestamptz not null default now(),
  fim timestamptz,
  total_lidos integer not null default 0,
  total_importados integer not null default 0,
  total_ignorados integer not null default 0,
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_clientes_uniplus_id on public.crm_clientes(uniplus_id);
create index if not exists idx_crm_vendas_uniplus_id on public.crm_vendas(uniplus_id);
create index if not exists idx_crm_vendas_data_venda on public.crm_vendas(data_venda);
create index if not exists idx_crm_vendas_cliente_id on public.crm_vendas(cliente_id);
create index if not exists idx_crm_vendas_vendedor_id on public.crm_vendas(vendedor_id);
create index if not exists idx_crm_itens_venda_venda_id on public.crm_itens_venda(venda_id);
create index if not exists idx_crm_itens_venda_produto_id on public.crm_itens_venda(produto_id);
create index if not exists idx_crm_produtos_uniplus_id on public.crm_produtos(uniplus_id);
create index if not exists idx_crm_alertas_data_prevista on public.crm_alertas_recompra(data_prevista_recompra);
create index if not exists idx_crm_alertas_status on public.crm_alertas_recompra(status);
create index if not exists idx_crm_alertas_vendedor on public.crm_alertas_recompra(vendedor_responsavel_id);
create index if not exists idx_crm_score_cliente_cliente_id on public.crm_score_cliente(cliente_id);
create index if not exists idx_crm_contatos_cliente_data on public.crm_historico_contatos(cliente_id, data_contato desc);
create index if not exists idx_crm_oportunidades_status on public.crm_oportunidades(status);
create index if not exists idx_crm_vendas_ignoradas_uniplus on public.crm_vendas_ignoradas(uniplus_venda_id);

create or replace function public.crm_calcular_qualidade_cadastro()
returns trigger
language plpgsql
as $$
declare
  score integer := 0;
begin
  if nullif(trim(new.nome), '') is not null then score := score + 15; end if;
  if nullif(trim(new.cpf_cnpj), '') is not null then score := score + 15; end if;
  if nullif(trim(new.telefone), '') is not null or nullif(trim(new.celular), '') is not null then score := score + 20; end if;
  if nullif(trim(new.whatsapp), '') is not null then score := score + 20; end if;
  if nullif(trim(new.email), '') is not null then score := score + 10; end if;
  if new.cidade_id is not null then score := score + 10; end if;
  if nullif(trim(new.bairro), '') is not null then score := score + 5; end if;
  if nullif(trim(new.endereco), '') is not null then score := score + 5; end if;

  new.qualidade_cadastro_score := score;
  new.qualidade_cadastro_status := case
    when score >= 90 then 'excelente'
    when score >= 70 then 'bom'
    when score >= 40 then 'regular'
    else 'ruim'
  end;
  return new;
end;
$$;

drop trigger if exists trg_crm_clientes_qualidade on public.crm_clientes;
create trigger trg_crm_clientes_qualidade
before insert or update of nome, cpf_cnpj, telefone, celular, whatsapp, email, cidade_id, bairro, endereco
on public.crm_clientes
for each row execute function public.crm_calcular_qualidade_cadastro();

drop trigger if exists trg_crm_clientes_updated_at on public.crm_clientes;
create trigger trg_crm_clientes_updated_at before update on public.crm_clientes
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_vendedores_updated_at on public.crm_vendedores;
create trigger trg_crm_vendedores_updated_at before update on public.crm_vendedores
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_produtos_updated_at on public.crm_produtos;
create trigger trg_crm_produtos_updated_at before update on public.crm_produtos
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_vendas_updated_at on public.crm_vendas;
create trigger trg_crm_vendas_updated_at before update on public.crm_vendas
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_itens_venda_updated_at on public.crm_itens_venda;
create trigger trg_crm_itens_venda_updated_at before update on public.crm_itens_venda
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_regras_updated_at on public.crm_regras_recompra;
create trigger trg_crm_regras_updated_at before update on public.crm_regras_recompra
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_alertas_updated_at on public.crm_alertas_recompra;
create trigger trg_crm_alertas_updated_at before update on public.crm_alertas_recompra
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_oportunidades_updated_at on public.crm_oportunidades;
create trigger trg_crm_oportunidades_updated_at before update on public.crm_oportunidades
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_score_updated_at on public.crm_score_cliente;
create trigger trg_crm_score_updated_at before update on public.crm_score_cliente
for each row execute function public.crm_set_updated_at();

alter table public.crm_clientes enable row level security;
alter table public.crm_vendedores enable row level security;
alter table public.crm_produtos enable row level security;
alter table public.crm_vendas enable row level security;
alter table public.crm_itens_venda enable row level security;
alter table public.crm_regras_recompra enable row level security;
alter table public.crm_alertas_recompra enable row level security;
alter table public.crm_historico_contatos enable row level security;
alter table public.crm_oportunidades enable row level security;
alter table public.crm_score_cliente enable row level security;
alter table public.crm_vendas_ignoradas enable row level security;
alter table public.crm_sincronizacoes enable row level security;

comment on table public.crm_vendas_ignoradas is 'Auditoria de registros do Uniplus descartados pelas regras de importação.';
comment on table public.crm_sincronizacoes is 'Execuções idempotentes da sincronização somente leitura do Uniplus.';
comment on column public.crm_alertas_recompra.origem is 'Camada que definiu a recorrência: produto, departamento, histórico, manual ou IA.';
