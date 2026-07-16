# Hennder Sync

## Fluxo atual

1. PostgreSQL local do Uniplus.
2. Hennder Sync local consulta vendas e cadastros.
3. Supabase recebe clientes, produtos, vendedores, vendas, itens, alertas e logs.
4. Frontend web le o Supabase.

## Estrategia de carga

- Sincronizacao periodica, recomendada a cada 5 minutos em horario comercial.
- Escopo diario para evitar sobrecarga.
- Carga historica deve ser feita em janela controlada.
- UPSERT por identificador do ERP evita duplicidade.

## Logs

- Um log diario consolidado.
- Erros devem registrar venda, erro e motivo.
- Vendas ignoradas devem explicar causa, como cliente nao encontrado ou dados incompletos.

## Depois

- Migrar o agente para VPS Linux/Docker quando o ambiente local estiver validado.
