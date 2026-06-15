# Hennder CRM

**Inteligência Comercial e Recompra**

CRM comercial para lojas dos segmentos agro e pet shop, com foco em recuperação de clientes, recompra, qualidade cadastral, afinidade com vendedores e oportunidades de venda cruzada.

Repositório: [github.com/ueddergomes100-prog/henndercrm](https://github.com/ueddergomes100-prog/henndercrm)

Esta etapa usa uma massa demonstrativa gerada a partir do formato real de uma consulta de ERP. Os nomes de clientes e vendedores foram preservados por solicitação; documentos, contatos e endereços permanecem pseudonimizados. O banco local do cliente é tratado como uma fonte estritamente somente leitura.

## Arquitetura

```text
ERP PostgreSQL local (somente leitura)
        |
Hennder Sync Agent local
        |
Supabase PostgreSQL
        |
Services de domínio
        |
API e frontend Next.js
```

O frontend não conhece tabelas ou consultas do ERP. O Hennder CRM Web nunca deve conectar diretamente ao banco local do cliente. A implementação real substituirá a massa temporária pelo Sync Agent sem alterar telas ou regras comerciais.

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
- `src/data/mock-uniplus.ts`: adaptador tipado para a massa demonstrativa gerada.
- `src/data/generated/uniplus-sample.json`: fixture demonstrativo gerado do CSV.
- `scripts/uniplus-sample-importer.mjs`: importador temporário e reproduzível do CSV.
- `scripts/uniplus-sample-importer.test.mjs`: testes de agrupamento, datas e anonimização.
- `src/integrations/uniplus`: interfaces e implementações mockadas dos repositórios.
- `src/integrations/uniplus/sql/sales-extraction.sql`: consulta somente leitura para a futura integração.
- `src/services`: sincronização, cálculos comerciais e view models.
- `src/infrastructure/supabase`: cliente REST e destino de sincronização Supabase.
- `src/infrastructure/crm-workspace-repository.ts`: persistência operacional local durável.
- `src/app/api/auth/session`: login, restauração e encerramento de sessão.
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

As implementações atuais são `MockUniplus*Repository`. O `UniplusSyncService` depende apenas das interfaces e nunca grava no Uniplus.

## Massa demonstrativa baseada no resultado SQL

O arquivo `H:\uniplus_sample_result.csv` foi usado somente como fonte local para gerar uma massa demonstrativa próxima da realidade. O CSV bruto não é versionado.

O importador:

- consolida uma venda por `uniplus_venda_id`;
- cria um item para cada `uniplus_item_id`;
- mantém a relação de uma venda para vários produtos;
- converte datas com anos fora de `1900..2100` para nulo;
- usa `venda_data_inclusao` e depois `venda_data_alteracao` quando `data_venda` é inválida ou nula;
- preserva valores, quantidades, produtos e padrões de compra;
- preserva os nomes de clientes, razões sociais e vendedores como vieram no banco;
- pseudonimiza documentos, telefones, endereços e e-mails;
- gera regras temporárias de recompra por tipo de produto.

Resultado atual:

- 100 linhas lidas;
- 43 vendas únicas;
- 100 itens únicos;
- 24 vendas com mais de um item;
- até 11 itens vinculados à mesma venda;
- 43 clientes, 12 vendedores e 85 produtos.

Para regenerar:

```bash
npm run import:uniplus-sample
npm test
```

Mapeamento principal:

| Uniplus | CRM |
| --- | --- |
| `entidade` | `crm_clientes` |
| `usuario` | `crm_vendedores` |
| `produto` | `crm_produtos` |
| `dav` | `crm_vendas` |
| `davitem` | `crm_itens_venda` |

Relacionamentos:

- `entidade.id = dav.idcliente`
- `dav.id = davitem.iddav`
- `davitem.idproduto = produto.id`
- `dav.idusuario = usuario.id`

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

A prévia pode ser executada por `POST /api/crm/sync/preview`.

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
6. Defina `CRM_OPERATIONAL_PROVIDER=supabase` para persistir as operações no banco remoto.
7. Troque `CRM_DATA_PROVIDER` para `supabase` quando o provider do snapshot comercial for implementado.

Com `CRM_OPERATIONAL_PROVIDER=local`, as operações são persistidas em `.data/crm-workspace.json`, ignorado pelo Git. Com `CRM_OPERATIONAL_PROVIDER=supabase`, contatos, status de alertas, oportunidades e agenda são gravados nas tabelas `crm_*`.

Nunca exponha `SUPABASE_SECRET_KEY` no navegador.

O projeto Supabase do Hennder CRM já está configurado:

- As duas migrations e o seed foram aplicados.
- As 14 tabelas `crm_*` foram verificadas no banco remoto.
- O bootstrap demonstrativo importou 19 vendas e auditou 3 vendas ignoradas.
- Foram gerados 15 alertas, 4 oportunidades e 5 eventos de agenda.
- O escopo por perfil de usuário e o CRUD operacional foram validados.

O bootstrap pode ser reexecutado por um administrador em `POST /api/crm/bootstrap`. A operação é idempotente para a massa demonstrativa.

As credenciais reais ficam somente em `.env.local`, que é ignorado pelo Git. Como a chave secreta foi compartilhada durante a configuração, ela deve ser rotacionada antes da publicação em produção.

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

1. Substituir as contas locais por Supabase Auth.
2. Consolidar o snapshot comercial no Supabase sem alterar a interface.
3. Manter a integração PostgreSQL com o Uniplus para a etapa final.
4. Validar o schema real do ERP e implementar os repositórios somente leitura.
5. Executar sincronização incremental e idempotente.
6. Integrar WhatsApp Business somente após consentimento, templates e webhooks.
