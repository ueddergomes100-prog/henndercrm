# Avaliações de Atendimento

Módulo isolado de apresentação para acompanhar qualidade de atendimento e
performance comercial.

## Estado atual

- Usa vendedores, vendas, itens, produtos e clientes reais já carregados pelo CRM.
- Não cria rota, API, tabela, autenticação ou permissão.
- Não contém avaliações, notas ou comentários simulados.
- Exibe estados vazios até uma fonte real de avaliações ser conectada.
- É carregado sob demanda a partir do menu `Inteligência > Avaliações`.
- Mantém atualização automática da fonte a cada 60 segundos.

## Integração futura

`service.ts` concentra o contrato da fonte de avaliações. A implementação futura
deve substituir `UnconnectedAttendanceEvaluationSource` por um adaptador que
retorne `AttendanceEvaluationDataset`.

Os canais previstos são:

- link público;
- WhatsApp;
- e-mail;
- SMS;
- QR Code.

A prévia da pesquisa pública existe apenas dentro das configurações do módulo.
Ela não possui rota nem envia dados enquanto a integração não for definida.

## Responsabilidades

- `types.ts`: contratos e DTOs da funcionalidade.
- `service.ts`: abstração da fonte de avaliações.
- `use-attendance-evaluations.ts`: estados, erro e atualização automática.
- `analytics.ts`: filtros e métricas derivadas.
- `attendance-evaluations-module.tsx`: interface, gráficos, ranking e drawers.
