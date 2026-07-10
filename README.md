# Hennder CRM

**Inteligência Comercial e Recompra**

CRM comercial para lojas dos segmentos agro e pet shop, com foco em recuperação de clientes, recompra, qualidade cadastral, afinidade com vendedores e oportunidades de venda cruzada.

Repositório: [github.com/ueddergomes100-prog/henndercrm](https://github.com/ueddergomes100-prog/henndercrm)

Esta etapa usa dados reais sincronizados do PostgreSQL do Uniplus para o Supabase. Qualquer exportacao real deve ser tratada como sensivel e nao versionavel. O banco do Uniplus deve ser tratado como uma fonte estritamente somente leitura.

## Arquitetura

```text
ERP PostgreSQL Uniplus (somente leitura)
        |
Hennder Sync local ou VPS Linux
        |
Supabase PostgreSQL (nuvem)
        |
API Next.js + services de dominio (Hostinger)
        |
Frontend web Hennder CRM
```

O frontend não conhece tabelas ou consultas do ERP. O Hennder CRM Web nunca deve conectar diretamente ao PostgreSQL do Uniplus. O Hennder Sync roda fora da Hostinger: primeiro nesta maquina com PostgreSQL acessivel localmente, depois em uma VPS Linux com Docker/rede privada/tunel/VPN. Ele envia os dados normalizados para o Supabase.

## Execução local

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Contas locais:

- Administrador: `admin@henndercrm.local` / `Admin@123`
- Supervisor: `supervisor@henndercrm.local` / `Supervisor@123`
- Vendedor: `vendedor@henndercrm.local` / `Vendedor@123`

As sessões usam cookie HTTP-only assinado. Administrador e supervisor podem operar toda a base; o vendedor recebe e altera apenas registros da própria carteira.

Validações:

```bash
npm run lint
npm run build
```

## Estrutura

- `src/domain/crm`: tipos de domínio e regras puras.
- `src/hennder-sync`: agente real de sincronizacao Uniplus -> Supabase.
- `scripts/hennder-sync.mjs`: wrapper CLI do agente.
- `scripts/hennder-sync-transformer.test.mjs`: testes de agrupamento, datas e transformacao.
- `src/integrations/uniplus`: contratos de integracao com o Uniplus.
- `docs/sql/uniplus_exportacao_crm_corrigida.sql`: consulta corrigida para exportacao/validacao do Uniplus.
- `src/integrations/uniplus/sql/sales-extraction.sql`: consulta antiga mantida como referencia; nao usar como SQL final.
- `src/services`: view models do CRM.
- `src/infrastructure/supabase`: cliente REST, snapshot e destino de sincronizacao Supabase.
- `src/app/api/auth/session`: login, restauração e encerramento de sessão.
- `src/app/api/crm/snapshot`: leitura real do snapshot comercial no Supabase.
- `src/app/api/crm/workspace`: contatos, alertas, agenda e oportunidades.
- `src/app/page.tsx`: interface navegável.
- `supabase/migrations`: schema versionado.
- `supabase/seed.sql`: massa inicial fictícia.

## Contratos do Uniplus

Foram criadas as interfaces:

- `IUniplusClientRepository`
- `IUniplusProductRepository`
- `IUniplusSaleRepository`
- `IUniplusSellerRepository`
- `ICrmSyncTargetRepository`

O agente real fica em `src/hennder-sync` e nunca grava no Uniplus.

Para testar o Sync real em modo seguro:

```bash
npm run sync:uniplus
```

Por padrao, o Sync busca somente vendas de hoje pelo campo `d.data`, evitando
carga grande no primeiro uso. Para uma janela controlada:

```bash
node scripts/hennder-sync.mjs --from 2026-05-10 --to 2026-07-11 --dry-run
```

Para gravar no Supabase, use explicitamente:

```bash
npm run sync:uniplus:apply
```

Mapeamento principal:

| Uniplus | CRM |
| --- | --- |
| `entidade` | `crm_clientes` |
| `entidade` via `dav.idrepresentante` | `crm_vendedores` |
| `produto` | `crm_produtos` |
| `dav` | `crm_vendas` |
| `davitem` | `crm_itens_venda` |
| `usuario` via `dav.idusuario` | auditoria do operador |

Relacionamentos:

- `entidade.id = dav.idcliente`
- `dav.id = davitem.iddav`
- `davitem.idproduto = produto.id`
- `dav.idrepresentante = entidade.id` para vendedor comercial
- `dav.idusuario = usuario.id` apenas para operador/auditoria

## Regras de importação

São importadas apenas vendas que possuam:

- Cliente identificado e ativo.
- Nome de cliente preenchido.
- Venda aprovada e não cancelada.
- Pelo menos um item.
- Produto válido em todos os itens.

Registros rejeitados são classificados como:

- `cliente_nao_identificado`
- `venda_cancelada`
- `item_sem_produto`
- `cliente_inativo`
- `dados_incompletos`

A previa segura e executada pelo CLI `npm run sync:uniplus`.

## Supabase

As migrations criam:

1. `crm_clientes`
2. `crm_vendedores`
3. `crm_produtos`
4. `crm_vendas`
5. `crm_itens_venda`
6. `crm_regras_recompra`
7. `crm_alertas_recompra`
8. `crm_historico_contatos`
9. `crm_oportunidades`
10. `crm_score_cliente`
11. `crm_vendas_ignoradas`
12. `crm_sincronizacoes`
13. `crm_usuarios`
14. `crm_agenda_eventos`

Também são criados índices, constraints, triggers de `updated_at`, cálculo automático de qualidade cadastral e Row Level Security. A segunda migration adiciona perfis `administrador`, `supervisor` e `vendedor`, além das políticas de agenda.

Para preparar outro projeto Supabase:

1. Crie o projeto.
2. Aplique a migration pelo SQL Editor ou Supabase CLI.
3. Execute `supabase/seed.sql`.
4. Copie `.env.example` para `.env.local`.
5. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`.
6. Rode `npm run sync:uniplus` para validar a leitura de hoje em dry-run.
7. Rode `npm run sync:uniplus:apply` somente quando o resumo estiver correto.

Contatos, status de alertas, oportunidades e agenda sao gravados diretamente nas tabelas `crm_*` do Supabase.

Nunca exponha `SUPABASE_SECRET_KEY` no navegador.

Para publicar em producao na Hostinger com Git e subdominio, siga `docs/PRODUCAO_HOSTINGER.md`.
Para implantar o agente de sincronizacao na VPS Linux, siga `docs/HENNDER_SYNC_VPS.md`.
O login de producao usa Supabase Auth vinculado a `public.crm_usuarios`; nao cadastre senhas reais em variaveis `CRM_*_PASSWORD`.

O projeto Supabase do Hennder CRM já está configurado:

- As duas migrations e o seed foram aplicados.
- As 14 tabelas `crm_*` foram verificadas no banco remoto.
- O bootstrap demonstrativo importou 19 vendas e auditou 3 vendas ignoradas.
- Foram gerados 15 alertas, 4 oportunidades e 5 eventos de agenda.
- O escopo por perfil de usuário e o CRUD operacional foram validados.

As credenciais de ambiente ficam fora do Git. Como a chave secreta foi compartilhada durante a configuração, ela deve ser rotacionada antes da publicação em produção.

## Regras comerciais

### Qualidade cadastral

- Nome: 15 pontos.
- CPF/CNPJ: 15 pontos.
- Telefone ou celular: 20 pontos.
- WhatsApp: 20 pontos.
- E-mail: 10 pontos.
- Cidade: 10 pontos.
- Bairro: 5 pontos.
- Endereço: 5 pontos.

Classificação: ruim até 39, regular até 69, bom até 89 e excelente a partir de 90.

### Inatividade

- Ativo: até 30 dias.
- Atenção: 31 a 60 dias.
- Risco: 61 a 90 dias.
- Perdido: acima de 90 dias.

### Vendedor preferencial

O vendedor com mais compras válidas é escolhido. Em empate, vence o maior valor total vendido. O percentual apresentado é a participação do vendedor nas compras do cliente.

### Recompra

Prioridade das regras:

1. Produto.
2. Palavra-chave.
3. Departamento.
4. Histórico individual.

A data prevista é `data_compra + dias_recompra`. O modelo impede duplicidade para a mesma combinação de cliente, produto, venda e item.

### Potencial perdido

```text
ticket médio * ciclos de compra estimados como perdidos
```

## Módulos atuais

- Dashboard executivo calculado.
- Clientes com filtros funcionais.
- Perfil 360 com compras, alertas, qualidade e vendedor preferencial.
- Central de recuperação e histórico persistente de contatos.
- Alertas de recompra com filtros e status persistentes.
- Carteira do vendedor.
- Saúde da base.
- Oportunidades com criação, edição e exclusão.
- Agenda comercial com criação, edição e exclusão.
- Autenticação com sessão HTTP-only e três perfis de acesso.
- IA comercial com respostas calculadas localmente.
- Relatórios demonstrativos derivados do snapshot.

## Próximos passos

Atualizacao de 10/07/2026:

- O CRM Web ja le o snapshot comercial diretamente do Supabase.
- O Hennder Sync local esta sincronizando vendas do dia atual em modo idempotente.
- A tela **Vendas** agora separa **Ultima sincronizacao** e **Todas**, com busca por venda/cliente, filtro por status, filtro por data e carregamento incremental de 25 registros.
- A tela **Logs e Sincronizacao** exibe o resumo diario do Sync, erros e vendas ignoradas.
- O transformador do Sync normaliza mojibake comum vindo do PostgreSQL/exportacao, evitando nomes como `GONÃALVES` quando a origem representa `GONÇALVES`.
- Dry-run historico de 2026-05-10 ate 2026-07-11, sem gravar no Supabase: 5000 linhas lidas, 2664 vendas identificadas, 4999 itens validos e 1 venda ignorada por cliente inativo.

Proximos passos antes da liberacao oficial:

1. Criar usuarios reais no Supabase Auth e vincular em `crm_usuarios`.
2. Garantir na Hostinger `CRM_COOKIE_SECURE=true`, `CRM_SESSION_SECRET` forte e chaves Supabase rotacionadas.
3. Aplicar a carga historica de 2 meses somente depois de revisar o dry-run e, se necessario, subir o limite/janelas em lotes.
4. Validar regras especificas do Uniplus para status, cancelamentos e devolucoes.
5. Integrar WhatsApp Business somente apos consentimento, templates e webhooks.
