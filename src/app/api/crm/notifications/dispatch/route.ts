import { SupabaseCrmNotificationRepository } from "@/infrastructure/supabase/supabase-crm-notification-repository";
import { processCrmNotifications } from "@/services/crm-notification-service";
import { sendPendingPushNotifications } from "@/services/crm-push-service";

export async function GET(request: Request) {
  return dispatch(request);
}

export async function POST(request: Request) {
  return dispatch(request);
}

async function dispatch(request: Request) {
  const denied = authorizeDispatch(request);
  if (denied) return denied;

  const repository = new SupabaseCrmNotificationRepository();
  const process = await processCrmNotifications(repository, { force: true });
  const push = await sendPendingPushNotifications(repository);

  return Response.json({
    ok: process.ok,
    process,
    push,
    timestamp: new Date().toISOString(),
  });
}

function authorizeDispatch(request: Request) {
  const secret = process.env.CRM_NOTIFICATIONS_DISPATCH_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRM_NOTIFICATIONS_DISPATCH_SECRET nao configurado." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret");

  return token === secret
    ? null
    : Response.json({ error: "Nao autorizado." }, { status: 401 });
}
