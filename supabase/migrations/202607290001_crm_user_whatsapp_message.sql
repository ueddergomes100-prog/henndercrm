alter table public.crm_usuarios
  add column if not exists mensagem_whatsapp text;

comment on column public.crm_usuarios.mensagem_whatsapp is
  'Modelo individual de mensagem do WhatsApp. Aceita {vendedor} e {cliente}.';
