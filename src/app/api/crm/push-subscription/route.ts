import { cookies } from "next/headers";
import type { CrmSessionUser } from "@/domain/crm/types";
import {
  isMissingNotificationSchemaError,
  type PushSubscriptionInput,
  SupabaseCrmNotificationRepository,
} from "@/infrastructure/supabase/supabase-crm-notification-repository";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import { getVapidPublicKey, isPushConfigured } from "@/services/crm-push-service";

type DeleteCommand = {
  endpoint?: string;
};

export async function GET() {
  return Response.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  try {
    const subscription = (await request.json()) as PushSubscriptionInput;
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return Response.json({ error: "Assinatura push invalida." }, { status: 400 });
    }

    await new SupabaseCrmNotificationRepository().savePushSubscription(
      user.id,
      subscription,
      request.headers.get("user-agent") ?? "",
    );

    return Response.json({ ok: true });
  } catch (error) {
    const status = isMissingNotificationSchemaError(error) ? 503 : 400;
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar push." },
      { status },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  try {
    const command = (await request.json()) as DeleteCommand;
    if (!command.endpoint) return Response.json({ ok: true });
    await new SupabaseCrmNotificationRepository().disablePushSubscription(
      user.id,
      command.endpoint,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao desativar push." },
      { status: 400 },
    );
  }
}

async function requireUser(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  return user ?? Response.json({ error: "Sessao expirada." }, { status: 401 });
}
