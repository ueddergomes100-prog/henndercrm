# Notificacoes push do Hennder CRM

## Estado implementado

O CRM agora possui a base para notificacoes individuais por usuario:

- Sino persistido por usuario no Supabase.
- Limpeza individual de notificacoes.
- Assinatura Web Push por aparelho/navegador.
- Service worker com eventos `push` e `notificationclick`.
- Botao `Ativar push` no sino.
- Botao administrativo `Testar todos`.
- Processador de notificacoes operacionais com cache de 5 minutos.

## Notificacoes geradas

- Retorno de cliente marcado para hoje.
- Retorno de cliente atrasado.
- Agenda comercial do dia.
- Recompra prevista para hoje.
- Recompra atrasada.
- Teste geral enviado por administrador.

Cada vendedor recebe somente notificacoes vinculadas ao seu `vendedor_id`.
Administradores podem enviar teste geral para todos os usuarios ativos.

## Migration obrigatoria no Supabase

Aplicar no SQL Editor do Supabase:

`supabase/migrations/202607210001_crm_push_notifications.sql`

Essa migration cria:

- `crm_notificacoes`
- `crm_notificacao_destinatarios`
- `crm_push_assinaturas`

Enquanto essa migration nao for aplicada, o CRM mostra aviso no sino e o teste geral
nao consegue ser gravado.

## Variaveis de ambiente

Configurar local e Hostinger:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:suporte@nexarcompany.com.br
```

As chaves locais foram geradas com:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

## Como testar

1. Aplicar a migration no Supabase.
2. Subir o sistema em producao ou rodar `npm run build` e `npm run start`.
3. Entrar no CRM com cada usuario em seu celular.
4. Abrir o sino e tocar em `Ativar push`.
5. No usuario administrador, tocar em `Testar todos`.
6. Confirmar:
   - usuarios com push ativo recebem notificacao no aparelho;
   - todos os usuarios ativos enxergam o teste no sino;
   - limpar notificacoes limpa somente para o usuario logado.

## Observacao iOS

No iPhone, Web Push exige que o CRM esteja adicionado a tela inicial como PWA e que
a permissao seja concedida depois de uma acao direta do usuario, como tocar no
botao `Ativar push`.
