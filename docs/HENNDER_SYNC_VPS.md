# Hennder Sync na VPS Linux

Este documento define o alvo operacional do Hennder Sync.

## Objetivo

O Hennder Sync sera o agente que le o PostgreSQL do Uniplus em modo somente
leitura e sincroniza os dados comerciais para o Supabase. O front-end web nunca
deve acessar o banco do Uniplus diretamente.

Fluxo esperado:

```text
PostgreSQL Uniplus (somente leitura)
VPS Linux / Hennder Sync
Supabase PostgreSQL (nuvem)
Hennder CRM Web (Hostinger)
```

## Onde Roda

O agente deve rodar em uma VPS Linux que consiga acessar o PostgreSQL do
Uniplus por um destes caminhos:

- container Docker na mesma rede do PostgreSQL;
- rede privada entre VPS e ambiente do Uniplus;
- tunel/VPN controlado;
- porta exposta com firewall restrito e usuario somente leitura.

A Hostinger hospeda apenas a aplicacao web.

## Variaveis De Ambiente

Na VPS do Sync:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

UNIPLUS_DATABASE_URL=postgres://readonly-user:readonly-password@uniplus-host:5432/uniplus-db
UNIPLUS_SSL=false
UNIPLUS_SYNC_BATCH_SIZE=5000
UNIPLUS_SYNC_MODE=incremental
HENNDER_SYNC_LOG_DIR=/var/log/hennder-sync
HENNDER_SYNC_DRY_RUN=false
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

## Comandos Desejados

Ainda precisam ser implementados:

```bash
node scripts/hennder-sync.mjs --since auto
node scripts/hennder-sync.mjs --since 2026-07-01T00:00:00-03:00
node scripts/hennder-sync.mjs --dry-run
```

O modo `--dry-run` deve conectar, ler, transformar e auditar, mas nao gravar no
Supabase.

## Ordem De Implementacao

1. Instalar `pg`.
2. Criar repositorios PostgreSQL reais para as interfaces em
   `src/integrations/uniplus/repositories.ts`.
3. Criar `scripts/hennder-sync.mjs`.
4. Reutilizar `UniplusSyncService`.
5. Usar `SupabaseCrmSyncRepository` como destino.
6. Registrar inicio/fim em `crm_sincronizacoes`.
7. Registrar descartes em `crm_vendas_ignoradas`.
8. Adicionar logs em arquivo na VPS.
9. Agendar por systemd timer, cron ou container Docker.
10. Depois, implementar provider Supabase para `/api/crm/snapshot`.

## Fixture Atual

A fixture local atual em `src/data/generated/uniplus-sample.json` foi gerada de
`docs/sql/resultadosql`, arquivo ignorado pelo Git:

- 500 linhas lidas;
- 266 vendas unicas;
- 500 itens;
- 246 clientes;
- 303 produtos;
- 9 vendedores;
- 114 vendas multi-item;
- maximo de 14 itens por venda;
- 0 linhas invalidas.
