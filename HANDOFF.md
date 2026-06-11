# Handoff do Projeto Hennder CRM

Atualizado em: 11/06/2026

## 1. Visao geral

O Hennder CRM, com o slogan "Inteligencia Comercial e Recompra", e um CRM comercial para uma loja dos segmentos agro e pet shop. O objetivo e usar os dados do ERP para identificar clientes sem compra, oportunidades de recompra, vendas cruzadas e clientes em risco, transformando essas informacoes em tarefas praticas para os vendedores.

O snapshot comercial continua usando dados ficticios no formato do Uniplus, mas o projeto ja possui dominio, services, contratos de integracao e Supabase remoto operacional. As migrations e o seed foram aplicados, e contatos, status de alertas, oportunidades e agenda ja persistem nas tabelas `crm_*`. Ainda nao existe conexao real com ERP, WhatsApp Business API ou modelo de IA.

Repositorio: `https://github.com/ueddergomes100-prog/henndercrm`

## 2. Stack atual

- Next.js 15.5.19 com App Router.
- React 19 e TypeScript.
- Tailwind CSS 4.
- Framer Motion.
- Recharts.
- Lucide React.
- Aplicacao visual principal em `src/app/page.tsx`.
- Dominio e regras em `src/domain/crm`.
- Services em `src/services`.
- Contratos Uniplus em `src/integrations/uniplus`.
- Infraestrutura Supabase em `src/infrastructure/supabase`.
- Migrations e seed em `supabase`.
- Estilos globais em `src/app/globals.css`.

IMPORTANTE: antes de escrever codigo de Next.js, seguir o `AGENTS.md`. Ele determina que a documentacao instalada em `node_modules/next/dist/docs/` deve ser consultada porque esta versao pode ter mudancas de API e convencoes.

## 3. Estado atual do frontend

### Login

- Tela visual de login.
- Sessao assinada armazenada em cookie HTTP-only.
- Contas locais de administrador, supervisor e vendedor.
- Administrador e supervisor operam toda a base.
- O vendedor recebe e altera apenas registros atribuidos a sua carteira.
- A migration operacional prepara o vinculo futuro com Supabase Auth.
- Contatos, status de alertas, oportunidades e agenda persistem no Supabase.

### Tema visual

- O cabecalho permite selecionar entre tema claro e dark profundo.
- A preferencia fica salva em `localStorage` e e aplicada antes da interface carregar.
- O tema escuro adapta paineis, formularios, tabelas, badges, navegacao e graficos.

### Dashboard

- KPIs comerciais coloridos.
- Graficos de evolucao de recompra e categorias.
- Ranking de clientes para contato.
- Ranking de vendedores.
- Indicadores calculados pelos services a partir do snapshot mock.
- Previa compacta de clientes sem compra.
- A previa mostra totais por faixa, os tres casos mais urgentes e um botao para abrir a Central de Recuperacao.
- A Dashboard foi propositalmente mantida resumida para nao ficar poluida.

### Clientes

- Tabela de clientes.
- Busca funcional por nome ou cidade.
- Exibe telefone, ultima compra, dias sem compra, ticket e score.
- Filtros funcionais de cidade, vendedor, status e qualidade cadastral.
- Permite abrir o perfil e iniciar contato via WhatsApp.
- Exibe vendedor preferencial, qualidade cadastral e potencial perdido.

### Perfil 360 do cliente

- Dados cadastrais e comerciais.
- Score, ticket, frequencia e dias sem compra.
- Oportunidades sugeridas.
- Alerta manual visual.
- Timeline comercial mockada.
- Historico das tentativas de contato registradas durante a sessao.
- Compras, itens e alertas derivados do snapshot.
- Vendedor preferencial e percentual de relacionamento.
- Qualidade cadastral calculada.

### Central de Recuperacao

- Modulo proprio no menu lateral.
- Lista clientes sem compra ordenados por quantidade de dias.
- Mostra potencial recuperavel, ultima compra e ultimo retorno.
- Possui botoes para WhatsApp, perfil e registro de retorno.
- Exibe indicadores de clientes inativos, casos acima de 90 dias, contatos e retornos agendados.
- Os filtros de faixa da Central de Recuperacao ainda sao apenas visuais.
- Possui historico consolidado de contatos.

### Registro de retorno

O usuario pode registrar:

- Cliente nao quis.
- Pediu contato mais tarde.
- Nao respondeu.
- Demonstrou interesse.
- Numero invalido.

Tambem pode informar:

- Observacao.
- Proxima data de contato.
- Canal e responsavel.

Os registros sao persistidos pelo endpoint `/api/crm/workspace` e sobrevivem ao recarregamento.

### Alertas de recompra

- Lista produto, cliente, vendedor, ultima compra, recorrencia, data recomendada e prioridade.
- Cadastro de alerta manual apenas visual.
- Botao direto para WhatsApp.
- Filtros de hoje, proximos sete dias, atrasados e prioridade funcionam.
- Acoes persistentes permitem marcar como contatado, convertido ou ignorado.

### Carteira do vendedor

- Modulo proprio no menu.
- Exibe clientes preferenciais, clientes em risco, alertas, potencial e conversao.
- Permite alternar entre vendedores e abrir o perfil do cliente.

### Saude da base

- Exibe clientes sem WhatsApp, telefone, cidade ou CPF/CNPJ.
- Mostra score medio e distribuicao por qualidade.
- Lista os cadastros de menor qualidade para correcao.

### Oportunidades

- Sugestoes de venda cruzada por cliente.
- Percentual de confianca mockado.
- Botao de WhatsApp com mensagem contextual contendo produto e sugestoes.
- Criacao, edicao, status, responsavel e exclusao persistentes.

### Agenda

- Visao semanal de ligacoes, visitas, retornos e recompras.
- Criacao, edicao e exclusao de compromissos.
- Persistencia operacional e controle por vendedor.
- Ainda nao existe integracao com calendario externo.

### IA Comercial

- Interface de chat demonstrativa.
- Respostas calculadas localmente a partir do snapshot para risco, potencial, vendedores, produtos e WhatsApp.
- Nao ha integracao com OpenAI ou outro modelo.

### Relatorios

- Indicadores e grafico de barras.
- Dados derivados do snapshot mock e das regras comerciais.

## 4. Integracao atual de WhatsApp

Os botoes usam links `https://wa.me/` com:

- Codigo do Brasil (`55`).
- Telefone normalizado.
- Mensagem contextual pre-preenchida.

Isso apenas abre o WhatsApp do usuario. Nao e uma integracao de automacao.

Para automacao futura sera necessario usar oficialmente a WhatsApp Business Platform, via Meta Cloud API ou provedor homologado, com templates, webhooks, consentimento e adequacao a LGPD.

## 5. Integracao planejada com ERP e PostgreSQL

O Supabase PostgreSQL sera alimentado com dados vindos do ERP da loja. A fonte oficial das vendas continuara sendo o ERP.

Dados minimos esperados:

- Clientes e identificadores unicos.
- Telefones normalizados.
- Produtos e categorias.
- Vendas e itens das vendas.
- Datas e valores.
- Vendedor de cada venda.
- Filial ou loja.
- Cancelamentos e devolucoes.

Os dados principais foram removidos de `page.tsx` e agora passam por services. A troca futura deve ocorrer no provider/repository, sem alterar as telas.

As 12 tabelas `crm_*` solicitadas foram criadas em `supabase/migrations/202606110001_crm_schema.sql`, com seed em `supabase/seed.sql`.

## 6. Regra para clientes sem compra

O alerta de cliente sem compra nao deve desaparecer porque houve uma tentativa de contato.

Comportamento esperado:

- Cada tentativa gera um registro em `contact_history`.
- O alerta continua ativo enquanto nao houver nova compra.
- Se o cliente pedir retorno, criar uma proxima acao ou agendamento.
- Quando o ERP importar uma nova compra, o sistema encerra ou marca a oportunidade como recuperada.
- O historico comercial deve permanecer mesmo depois da recuperacao.

## 7. Afinidade entre cliente e vendedor

A loja possui aproximadamente 10 vendedores. Muitos clientes preferem ou compram sempre com determinado vendedor.

Ao importar vendas, importar obrigatoriamente o identificador do vendedor. O CRM deve calcular afinidade entre cliente e vendedor e sugerir quem deve fazer o contato nas telas de Recuperacao, Alertas e Oportunidades.

Nao usar somente a regra rigida de cinco vendas. Sugestao:

- Exigir pelo menos cinco compras validas para gerar uma recomendacao forte.
- Considerar participacao do vendedor nas compras do cliente.
- Dar peso maior para vendas recentes.
- Considerar quantidade de compras, valor vendido e frequencia.
- Ignorar vendas canceladas.
- Tratar devolucoes.
- Permitir atribuicao manual pelo gerente.
- Vendedor fixado manualmente deve prevalecer sobre o calculo.

Exemplo de score:

- 40% quantidade de compras.
- 30% recencia.
- 20% valor vendido.
- 10% frequencia.

Classificacao sugerida:

- Alta afinidade: 70% ou mais.
- Afinidade provavel: 50% a 69%.
- Sem preferencia clara: abaixo de 50%.

Exibicao sugerida:

`Vendedor recomendado: Carlos Mendes - afinidade 82% - 6 das ultimas 8 compras`

## 8. Bot comercial futuro

Fluxo desejado:

1. ERP envia vendas ao PostgreSQL.
2. Regras identificam cliente inativo ou oportunidade.
3. Sistema escolhe o vendedor recomendado.
4. Bot envia mensagem aprovada pelo WhatsApp Business.
5. Webhook recebe a resposta.
6. IA ou regras classificam a resposta.
7. CRM registra o resultado.
8. Sistema agenda retorno, encerra tentativa ou transfere para vendedor.
9. Nova compra no ERP encerra a oportunidade como recuperada.

Implementar em etapas:

1. Automacao simples com templates e respostas controladas.
2. Interpretacao de respostas e atualizacao automatica do CRM.
3. Agente comercial contextual com transferencia para humano.

## 9. Proxima ordem recomendada de trabalho

1. Substituir as contas locais por Supabase Auth.
2. Implementar o provider de leitura do snapshot no Supabase.
3. Revisar seguranca, RLS e fluxo de publicacao.
4. Manter a integracao PostgreSQL com o Uniplus para a etapa final.
5. No computador com acesso ao ERP, validar o SQL de extracao contra o schema real.
6. Executar sincronizacao incremental e idempotente.
7. Tratar devolucoes e regras especificas de status do Uniplus.
8. Conectar WhatsApp Business e webhooks.
9. Adicionar IA externa apenas depois que dados e historicos estiverem confiaveis.

## 10. Cuidados tecnicos

- O worktree ja estava modificado antes deste handoff. Nao reverter arquivos sem analisar.
- Nao assumir que mudancas em `package.json`, lockfile, configuracoes ou layout sao descartaveis.
- A interface ainda esta concentrada em `src/app/page.tsx`, mas tipos, dados e regras ja foram extraidos.
- Separar os componentes visuais de forma incremental, preservando o comportamento aprovado.
- Os numeros atuais sao demonstrativos, embora agora sejam calculados a partir do conjunto mock.
- A persistencia operacional usa o Supabase quando `CRM_OPERATIONAL_PROVIDER=supabase`.
- O fallback local continua disponivel em `.data/crm-workspace.json` com `CRM_OPERATIONAL_PROVIDER=local`.
- O projeto remoto Supabase esta configurado; as credenciais ficam apenas em `.env.local`.
- A chave secreta compartilhada durante a configuracao deve ser rotacionada antes da producao.
- As contas atuais sao demonstrativas e devem migrar para Supabase Auth antes da producao.
- O cadastro de alerta manual continua apenas visual; os status dos alertas calculados ja persistem.
- Antes de continuar, rodar `npm run lint` e `npm run build`.

## 11. Validacao atual

Na ultima alteracao:

- `npm run lint` passou.
- `npm run build` passou.
- Navegacao da Dashboard para a Central de Recuperacao foi validada.
- Registro de retorno foi testado em estado local.
- Links de WhatsApp foram verificados com numeros brasileiros normalizados.
- Contagens de clientes sem compra agora refletem os clientes presentes no mock.
- Registro de retorno agora permite selecionar canal e informar responsavel.
- A interface identifica explicitamente que os dados exibidos sao demonstrativos.
- O `AGENTS.md` agora orienta consultar a documentacao oficial da versao instalada quando `node_modules/next/dist/docs/` nao existir.
- O `README.md` foi atualizado para refletir a estrutura e as limitacoes reais do Hennder CRM.
- Dominio, regras comerciais e services foram criados.
- Contratos e repositorios mockados do Uniplus foram criados.
- `UniplusSyncService` implementa regras de importacao e auditoria de vendas ignoradas.
- Migrations e seed Supabase foram criados e aplicados no projeto remoto.
- As 14 tabelas `crm_*` foram verificadas.
- O bootstrap importou 19 vendas, auditou 3 ignoradas e gerou 15 alertas, 4 oportunidades e 5 eventos.
- O CRUD remoto e o isolamento entre administrador e vendedor foram validados.
- Rotas `/api/crm/snapshot` e `/api/crm/sync/preview` foram adicionadas.
- A rota administrativa `/api/crm/bootstrap` inicializa a massa demonstrativa de forma idempotente.
- Filtros de clientes, alertas, Carteira do Vendedor e Saude da Base foram implementados.
- `npm run lint` e `npm run build` passaram apos essas alteracoes.

## 12. Arquivos principais

- `AGENTS.md`: regras obrigatorias para trabalhar com esta versao do Next.js.
- `src/app/page.tsx`: telas, dados mockados, navegacao e logica local.
- `src/domain/crm`: tipos e regras comerciais puras.
- `src/data/mock-uniplus.ts`: fonte ficticia no formato do Uniplus.
- `src/integrations/uniplus`: contratos e repositorios mockados.
- `src/services`: sincronizacao, services e view models.
- `src/infrastructure/supabase`: cliente REST e destino de sincronizacao.
- `supabase/migrations/202606110001_crm_schema.sql`: schema Supabase.
- `supabase/seed.sql`: massa de dados inicial.
- `src/app/globals.css`: tema visual e estilos globais.
- `src/app/layout.tsx`: metadata, fontes e layout raiz.
- `package.json`: dependencias e scripts.
