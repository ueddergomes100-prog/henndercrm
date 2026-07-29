# Regras do CRM

## Resultados e atribuicao

- Compra ate 10 dias apos contato ou clique de acao: 100% em faturamento recuperado.
- Compra entre 11 e 20 dias: 75% em faturamento influenciado.
- Compra entre 21 e 30 dias: 50% em faturamento influenciado.
- Compra depois de 30 dias: nao entra nas estatisticas de recuperacao/influencia.
- Contato registrado como sem resposta continua elegivel durante a mesma janela de 30 dias.
- Cada venda entra uma unica vez e fica ligada ao contato valido mais proximo que ocorreu antes dela.

## Contato comercial

- Clique em WhatsApp registra intencao de contato uma vez por cliente/dia.
- Registro de retorno continua sendo a fonte mais forte para o painel de resultados.
- O botao de WhatsApp nao envia mensagem automatica; ele abre conversa manual.
- Todo clique de acao cria ou atualiza um lembrete individual para o vendedor em 7 dias.
- Se houver compra aprovada depois do contato, o lembrete aberto e removido e a nova recompra passa a contar dessa venda.
- Cada vendedor pode personalizar sua mensagem em Configuracoes usando `{vendedor}` e `{cliente}`.

## Recompra

- Produto com regra manual usa os dias definidos pelo cliente.
- Produto sem regra manual usa fallback automatico por item/departamento/palavra-chave.
- Produto importado pelo codigo nao deve duplicar cadastro.

## Carteira

- Administrador ve carteiras separadas por vendedor.
- Vendedor ve clientes, vendas, clientes sem compra e oportunidades da propria carteira.
