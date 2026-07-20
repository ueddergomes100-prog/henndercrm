# Hennder Sync local e VPS Linux

Este documento define o alvo operacional do Hennder Sync. Por enquanto ele pode
rodar nesta maquina Windows com acesso ao PostgreSQL do Uniplus; depois a mesma
rotina migra para VPS Linux/Docker.

## Objetivo

O Hennder Sync sera o agente que le o PostgreSQL do Uniplus em modo somente
leitura e sincroniza os dados comerciais para o Supabase. O front-end web nunca
deve acessar o banco do Uniplus diretamente.

Fluxo esperado:

```text
PostgreSQL Uniplus (somente leitura)
Hennder Sync local ou VPS Linux
Supabase PostgreSQL (nuvem)
Hennder CRM Web (Hostinger)
```

## Onde Roda Agora

Etapa atual:

- maquina Windows de desenvolvimento;
- PostgreSQL do Uniplus acessivel localmente ou pela rede;
- Node.js rodando `scripts/hennder-sync.mjs`.

Etapa futura:

- VPS Linux que consiga acessar o PostgreSQL do Uniplus por um destes caminhos:

- container Docker na mesma rede do PostgreSQL;
- rede privada entre VPS e ambiente do Uniplus;
- tunel/VPN controlado;
- porta exposta com firewall restrito e usuario somente leitura.

A Hostinger hospeda apenas a aplicacao web.

## Variaveis De Ambiente

Na maquina local ou VPS do Sync:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

UNIPLUS_DATABASE_URL=postgres://readonly-user:readonly-password@uniplus-host:5432/uniplus-db
UNIPLUS_SSL=false
UNIPLUS_SYNC_BATCH_SIZE=5000
UNIPLUS_SYNC_MODE=incremental
UNIPLUS_SYNC_LOOKBACK_MINUTES=15
UNIPLUS_SYNC_START_DATE=2026-05-01
HENNDER_SYNC_LOG_DIR=.data/hennder-sync-logs
```

Nunca usar usuario administrador do banco do Uniplus. O usuario do Sync deve ter
apenas `CONNECT`, `USAGE` no schema correto e `SELECT` nas tabelas necessarias.

## Regras Criticas Do Uniplus

- `dav.codigo` e o numero comercial/visivel da venda.
- `dav.id` e o ID interno DAV.
- `dav.idrepresentante` e o vendedor/representante comercial.
- `dav.idusuario` e apenas operador/usuario que lancou ou alterou a venda.
- `davitem.iddav` referencia `dav.id`, nao `dav.codigo`.

Antes de carga grande, validar a venda `330670` com o SQL em
`docs/sql/uniplus_validacao_venda_330670.sql`.

## Comandos

Disponiveis agora:

```bash
npm run sync:uniplus
npm run sync:uniplus:apply
node scripts/hennder-sync.mjs --dry-run
node scripts/hennder-sync.mjs --apply
node scripts/hennder-sync.mjs --date 2026-07-10 --dry-run
node scripts/hennder-sync.mjs --from 2026-05-10 --to 2026-07-11 --dry-run
node scripts/hennder-sync.mjs --since auto --dry-run
node scripts/hennder-sync.mjs --since 2026-07-01T00:00:00-03:00 --apply
```

O modo `--dry-run` deve conectar, ler, transformar e auditar, mas nao gravar no
Supabase. Ele e o comportamento padrao e recomendado para o primeiro teste.
Para gravar no Supabase, use `--apply` explicitamente.
Na VPS Linux, `HENNDER_SYNC_LOG_DIR` pode ser trocado para `/var/log/hennder-sync`.
Sem `--since`, `--date`, `--from` ou `--to`, o Sync busca somente vendas de hoje
pela data saneada da venda. `npm run sync:uniplus:auto` usa o ultimo sync
concluido, refaz os 15 minutos anteriores de forma idempotente e nunca importa
vendas anteriores a `UNIPLUS_SYNC_START_DATE`.

Os campos `dav.datainclusao` e `dav.dataalteracao` do Uniplus sao horarios
locais sem fuso. O modo incremental os interpreta em `America/Sao_Paulo` antes
de comparar com o horario UTC salvo no Supabase. Datas absurdas em `dav.data`
sao descartadas e substituidas por inclusao ou alteracao validas.

## Ordem De Implementacao

1. Validar `UNIPLUS_DATABASE_URL` nesta maquina.
2. Rodar `npm run sync:uniplus` em dry-run somente com vendas de hoje.
3. Conferir `rowsRead`, `imported`, `ignoredSales` e `digest`.
4. Depois, testar janela maior com `node scripts/hennder-sync.mjs --from 2026-05-10 --to 2026-07-11 --dry-run`.
5. Quando o resumo estiver correto, rodar `npm run sync:uniplus:apply`.
6. Conferir `crm_sincronizacoes` e `crm_vendas_ignoradas` no Supabase.
7. Conferir `/api/crm/snapshot` lendo as tabelas reais do Supabase.
8. Migrar a rotina para VPS Linux/Docker e agendar por systemd timer, cron ou
   container.

## Estado Atual

O CRM nao carrega mais fixture mockada. O front-end le o snapshot comercial do
Supabase, e o agente real fica em `src/hennder-sync`.

Em 20/07/2026, a rotina local Windows esta ativa no Agendador de Tarefas a cada
5 minutos com `npm run sync:uniplus:auto`. A consulta incremental validada leva
cerca de 2 segundos e usa uma sobreposicao de 15 minutos para capturar vendas
faturadas ou alteradas entre execucoes sem criar duplicidades.

A tela **Vendas** usa `crm_vendas.updated_at` para separar as vendas tocadas
pela ultima sincronizacao da lista completa. A aba **Todas** continua
disponivel, mas a interface aplica busca, filtros e carregamento incremental
para evitar uma tabela grande demais.

Reconciliacao historica aplicada e auditada:

```bash
node scripts/hennder-sync.mjs --from 2026-05-01 --to 2026-07-21 --apply --limit 100000
```

Resultado final conferido em 20/07/2026: 6.403 vendas, 12.055 itens e
R$ 1.318.641,45 tanto no Uniplus quanto no Supabase. A auditoria encontrou zero
vendas ou itens faltantes, excedentes ou divergentes e zero clientes com
`data_ultima_compra` desatualizada.

O caso `PATRICIA WERNER` foi validado com as vendas 326958, de 05/06/2026, e
335452, de 11/07/2026. O snapshot passou a exibir ultima compra em 11/07,
9 dias sem compra e status ativo.
