# Producao na Hostinger

Roteiro para publicar o Hennder CRM em um subdominio usando Hostinger + Git.

Fonte Hostinger consultada: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

## 1. Senhas reais

As senhas de teste nao devem ser usadas em producao:

- `admin@henndercrm.local`
- `supervisor@henndercrm.local`
- `vendedor@henndercrm.local`

Crie usuarios reais no Supabase Auth e vincule cada usuario em `public.crm_usuarios`.

Campos obrigatorios em `crm_usuarios`:

- `auth_user_id`: id do usuario em Supabase Auth
- `nome`
- `email`
- `perfil`: `administrador`, `supervisor` ou `vendedor`
- `vendedor_id`: obrigatorio quando `perfil = vendedor`
- `ativo = true`

## 2. Rotacao das chaves do Supabase

Antes de publicar, rotacione as chaves no painel do Supabase, porque chaves foram usadas no ambiente local.

Atualize na Hostinger:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Nunca use `SUPABASE_SECRET_KEY` com prefixo `NEXT_PUBLIC_`.

## 3. Cookie seguro

Em producao:

```env
CRM_COOKIE_SECURE=true
```

Tambem gere um segredo forte:

```env
CRM_SESSION_SECRET=
```

Use pelo menos 32 caracteres aleatorios.

## 4. Dominio, subdominio e HTTPS

No painel da Hostinger:

1. Crie o subdominio desejado, por exemplo `crm.seudominio.com.br`.
2. Aponte o subdominio para o app Node.js.
3. Ative SSL/HTTPS para o subdominio.
4. Confirme que `https://crm.seudominio.com.br/api/health` responde `ok: true`.

## 5. Ambiente de producao separado

Configure as variaveis no painel da Hostinger, nao envie `.env.local` para o Git.

Variaveis recomendadas:

```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
CRM_SESSION_SECRET=gere-um-segredo-forte
CRM_COOKIE_SECURE=true
```

Estas variaveis sao da aplicacao web. As variaveis `UNIPLUS_*` e
`HENNDER_SYNC_*` pertencem ao Hennder Sync no ambiente que acessa o PostgreSQL
do Uniplus, primeiro nesta maquina local e depois na VPS Linux. Elas nao
precisam ficar na Hostinger.

## 5.1 Hennder Sync local e VPS Linux

O Hennder Sync deve rodar fora da Hostinger. Na etapa atual, ele roda nesta
maquina local com acesso ao PostgreSQL do Uniplus. Depois, a mesma rotina migra
para uma VPS Linux com acesso ao PostgreSQL via Docker, rede privada ou
tunel/VPN.

Fluxo de producao:

```text
PostgreSQL Uniplus (somente leitura)
Hennder Sync local ou VPS Linux
Supabase PostgreSQL
Hennder CRM Web na Hostinger
```

No ambiente do Sync, configure `UNIPLUS_DATABASE_URL`, `UNIPLUS_SSL`,
`UNIPLUS_SYNC_BATCH_SIZE`, `UNIPLUS_SYNC_MODE`, `HENNDER_SYNC_LOG_DIR` e as
chaves Supabase server-side. O usuario PostgreSQL do Uniplus deve ser somente
leitura. A gravacao no Supabase exige o comando explicito `npm run
sync:uniplus:apply`.

## 6. RLS e permissoes

Validacoes obrigatorias antes de liberar usuarios reais:

- Administrador acessa toda a base.
- Supervisor acessa toda a base operacional permitida.
- Vendedor acessa somente a propria carteira.
- Vendedor nao consegue alterar cliente, agenda ou oportunidade de outro vendedor.
- Usuario inativo em `crm_usuarios` nao consegue acessar o sistema.

## 7. Usuarios reais

Substitua as contas de teste por e-mails reais.

Sugestao inicial:

- 1 administrador principal
- 1 supervisor
- 1 vendedor piloto

Depois de validar, cadastre os demais vendedores pela tela **Sistema > Configuracoes > Cadastrar usuario** e vincule cada vendedor ao respectivo `crm_vendedores.id`.

## 8. Backup e recuperacao

No Supabase:

- Ative backups do projeto.
- Confirme o plano de retencao.
- Exporte um backup antes da primeira carga real.
- Guarde um procedimento de restauracao.

## Deploy na Hostinger com Git

Configuracao recomendada do app Node.js:

- Node.js: versao 20 LTS
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start -- -p $PORT`
- App URL: subdominio com HTTPS

O build usa `output: "standalone"` do Next.js. O comando `npm run build`
gera `.next/standalone` e copia `public` + `.next/static` para dentro do
pacote standalone. O comando `npm run start` executa o wrapper `server.js`,
que inicia `.next/standalone/server.js`, define `NODE_ENV=production` quando
necessario e respeita `PORT`, `-p` ou `--port`.

Mantenha o CRM apenas em `gestao.nexarcompany.com.br`. Se existir outro app
Node.js ligado a `nexarcompany.com.br`, remova/desconecte esse app para nao
duplicar consumo de recursos. O codigo tambem redireciona o dominio raiz para
o subdominio quando o runtime esta ativo, mas isso nao substitui a remocao do
app duplicado no painel.

Depois do deploy, testar:

```text
https://SEU-SUBDOMINIO/api/health
https://SEU-SUBDOMINIO
```

## Checklist final

- [ ] Chaves Supabase rotacionadas.
- [ ] Variaveis configuradas na Hostinger.
- [ ] SSL ativo no subdominio.
- [ ] Usuarios reais criados no Supabase Auth.
- [ ] Perfis vinculados em `crm_usuarios`.
- [ ] Login testado com administrador, supervisor e vendedor.
- [ ] Restricao por vendedor validada.
- [ ] Backup Supabase ativado.
