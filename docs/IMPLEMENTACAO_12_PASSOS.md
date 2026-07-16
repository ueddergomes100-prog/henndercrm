# Implementacao dos 12 passos do Hennder CRM

Data: 2026-07-16

## Escopo desta etapa

Implementar os itens pendentes ate o passo 12, exceto mensagens automaticas, que dependem de automacao externa e ficam para a etapa final.

## 1. Notificacoes no topo

O sino da barra superior deixou de ser decorativo e agora abre uma lista de notificacoes comerciais. A lista mostra recompra atrasada, contatos de hoje, agenda do dia e cadastros fracos. Cada item abre o cliente ou a tela relacionada.

## 2. Agenda dinamica

A agenda nao usa mais a semana fixa de junho. Ela calcula automaticamente a semana util da data de referencia do CRM.

## 3. Cliente manual persistente

O cadastro manual de cliente agora salva no Supabase pela rota de workspace. O cliente recebe ID real do banco e fica disponivel para atualizar WhatsApp e criar acoes operacionais.

## 4. Campanhas funcionais

A tela de campanhas virou uma central operacional com publico por campanha, playbook e lista dos 20 primeiros clientes. O usuario pode abrir perfil e chamar no WhatsApp manualmente.

## 5. Configuracoes explicativas

Os cards de configuracao agora sao selecionaveis e exibem detalhes sobre usuarios, permissoes, empresa, atribuicao, integracao e preferencias.

## 6. WhatsApp manual em alertas

A opcao do alerta manual foi ajustada para "lembrar contato por WhatsApp". Ela cria observacao/lembrete, mas nao envia mensagem automatica.

## 7. Automacao de WhatsApp

Nao foi implementada nesta etapa por decisao do escopo. Continua reservada para a etapa final com WhatsApp Business/API, webhooks e rotina de automacao.

## 8. Inteligencia do assistente e Obsidian

Foi criado o vault `obsidian/Hennder-CRM-Knowledge` com regras do CRM, Hennder Sync, playbooks, assistente e roadmap. A IA Comercial reconhece perguntas sobre Obsidian/treinamento e aponta para esse repositorio.

## 9. Relatorios

Os relatorios continuam abrindo uma tela pronta para salvar como PDF pelo navegador. A geracao de PDF no servidor fica documentada como melhoria futura.

## 10. Selo de dados

O selo "Dados demonstrativos" foi trocado por "Dados sincronizados".

## 11. Sync e carga historica

A documentacao reforca o fluxo atual: PostgreSQL local do Uniplus, Hennder Sync local, Supabase em nuvem e front-end web. A carga historica deve ser feita em janela controlada.

## 12. Gestao de usuarios

Administradores agora podem editar nome, perfil, vendedor vinculado e senha provisoria. Administradores nao podem ser excluidos nem rebaixados.

## Observacoes

- Mensagens automaticas ficam fora deste ciclo.
- O vault Obsidian e a base inicial para treinar o agente.
- Algumas configuracoes exibem estado operacional documentado; persistencia em tabela dedicada pode ser criada numa etapa futura.
