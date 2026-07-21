import { cookies } from "next/headers";
import type { CrmSessionUser } from "@/domain/crm/types";
import {
  isMissingNotificationSchemaError,
  SupabaseCrmNotificationRepository,
} from "@/infrastructure/supabase/supabase-crm-notification-repository";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import { getVapidPublicKey, isPushConfigured, sendPendingPushNotifications } from "@/services/crm-push-service";
import {
  createTestNotificationForAllUsers,
  processCrmNotifications,
} from "@/services/crm-notification-service";

type NotificationCommand =
  | { action: "clear_all" }
  | { action: "mark_read"; id: string }
  | { action: "test_all" }
  | { action: "process" };

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const repository = new SupabaseCrmNotificationRepository();
  const processResult = await processCrmNotifications(repository);

  try {
    const notifications = processResult.schemaReady
      ? await repository.listForUser(user.id)
      : [];
    return Response.json({
      notifications,
      process: processResult,
      push: {
        configured: isPushConfigured(),
        publicKey: getVapidPublicKey(),
      },
    });
  } catch (error) {
    if (isMissingNotificationSchemaError(error)) {
      return Response.json({
        notifications: [],
        process: processResult,
        push: {
          configured: isPushConfigured(),
          publicKey: getVapidPublicKey(),
        },
        schemaReady: false,
      });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar notificacoes." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  try {
    const command = (await request.json()) as NotificationCommand;
    const repository = new SupabaseCrmNotificationRepository();

    switch (command.action) {
      case "clear_all":
        await repository.markAllCleared(user.id);
        return Response.json({ ok: true });
      case "mark_read":
        await repository.markRead(user.id, command.id);
        return Response.json({ ok: true });
      case "process": {
        const process = await processCrmNotifications(repository);
        const push = await sendPendingPushNotifications(repository);
        return Response.json({ ok: process.ok, process, push });
      }
      case "test_all": {
        if (user.role !== "administrador") {
          return Response.json({ error: "Apenas administradores podem enviar teste geral." }, { status: 403 });
        }
        const created = await createTestNotificationForAllUsers(user, repository);
        const push = await sendPendingPushNotifications(repository);
        return Response.json({ ok: true, created, push });
      }
      default:
        return Response.json({ error: "Acao invalida." }, { status: 400 });
    }
  } catch (error) {
    const status = isMissingNotificationSchemaError(error) ? 503 : 400;
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao processar notificacao." },
      { status },
    );
  }
}

async function requireUser(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  return user ?? Response.json({ error: "Sessao expirada." }, { status: 401 });
}
