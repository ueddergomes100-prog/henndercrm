import "server-only";

import webPush from "web-push";
import type { PushSubscription } from "web-push";
import { SupabaseCrmNotificationRepository } from "@/infrastructure/supabase/supabase-crm-notification-repository";

export type PushDeliveryResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function sendPendingPushNotifications(
  repository = new SupabaseCrmNotificationRepository(),
): Promise<PushDeliveryResult> {
  if (!isPushConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );

  const recipients = await repository.listPendingPushRecipients(120);
  const notifications = await repository.listNotificationsByIds([
    ...new Set(recipients.map((recipient) => recipient.notificacao_id)),
  ]);
  const notificationById = new Map(notifications.map((notification) => [notification.id, notification]));
  const subscriptions = await repository.listPushSubscriptionsForUsers([
    ...new Set(recipients.map((recipient) => recipient.usuario_id)),
  ]);
  const subscriptionsByUserId = new Map<string, typeof subscriptions>();

  for (const subscription of subscriptions) {
    const list = subscriptionsByUserId.get(subscription.usuario_id) ?? [];
    list.push(subscription);
    subscriptionsByUserId.set(subscription.usuario_id, list);
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const notification = notificationById.get(recipient.notificacao_id);
    const userSubscriptions = subscriptionsByUserId.get(recipient.usuario_id) ?? [];
    if (!notification) {
      skipped += 1;
      await repository.markPushError(recipient.id, "Notificacao indisponivel para envio push.");
      continue;
    }
    if (!userSubscriptions.length) {
      skipped += 1;
      await repository.markPushError(recipient.id, "Usuario ainda nao ativou push em nenhum aparelho.");
      continue;
    }

    const payload = JSON.stringify({
      title: notification.titulo,
      body: notification.descricao,
      icon: "/icons/hennder-icon-192.png",
      badge: "/icons/hennder-icon-96.png",
      tag: notification.id,
      data: {
        notificationId: notification.id,
        customerId: notification.cliente_id,
        view: notification.destino_view,
        url: "/",
      },
    });

    const results = await Promise.allSettled(
      userSubscriptions.map(async (subscription) => {
        attempted += 1;
        await webPush.sendNotification(
          toWebPushSubscription(subscription.endpoint, subscription.p256dh, subscription.auth),
          payload,
        );
      }),
    );

    const ok = results.some((result) => result.status === "fulfilled");
    sent += results.filter((result) => result.status === "fulfilled").length;
    failed += results.filter((result) => result.status === "rejected").length;

    if (ok) {
      await repository.markPushSent(recipient.id);
    } else {
      await repository.markPushError(recipient.id, "Falha ao entregar push nos aparelhos ativos.");
    }
  }

  return { attempted, sent, failed, skipped };
}

function toWebPushSubscription(endpoint: string, p256dh: string, auth: string): PushSubscription {
  return {
    endpoint,
    keys: { p256dh, auth },
  };
}
