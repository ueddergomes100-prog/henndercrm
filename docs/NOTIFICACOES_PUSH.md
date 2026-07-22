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
- Despachador server-side para enviar push mesmo com o PWA fechado.

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
CRM_NOTIFICATIONS_DISPATCH_SECRET=
CRM_PUBLIC_URL=https://gestao.nexarcompany.com.br
CRM_NOTIFICATIONS_DISPATCH_INTERVAL_MS=300000
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
5. Tocar em `Testar local` para validar se o aparelho mostra notificacao na barra.
6. No usuario administrador, tocar em `Testar todos`.
7. Confirmar:
   - usuarios com push ativo recebem notificacao no aparelho;
   - todos os usuarios ativos enxergam o teste no sino;
   - limpar notificacoes limpa somente para o usuario logado.

## Despacho com app fechado

O sininho aparece quando o CRM abre, mas a barra do celular so recebe push quando
o servidor executa o despacho. Em producao, o `server.js` agenda chamadas para:

`/api/crm/notifications/dispatch`

O agendamento roda a cada 5 minutos por padrao quando estas variaveis existem:

- `CRM_NOTIFICATIONS_DISPATCH_SECRET`
- `CRM_PUBLIC_URL`

Tambem e possivel chamar manualmente:

```bash
npm run notifications:dispatch
```

ou configurar um cron externo chamando:

```text
POST https://gestao.nexarcompany.com.br/api/crm/notifications/dispatch
Authorization: Bearer CRM_NOTIFICATIONS_DISPATCH_SECRET
```

## Observacao iOS

No iPhone, Web Push exige que o CRM esteja adicionado a tela inicial como PWA e que
a permissao seja concedida depois de uma acao direta do usuario, como tocar no
botao `Ativar push`.
