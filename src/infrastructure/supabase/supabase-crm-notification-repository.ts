import "server-only";

import type { CrmSessionUser } from "@/domain/crm/types";
import { SupabaseRestClient } from "./supabase-rest-client";

export type CrmNotificationTone = "red" | "amber" | "cyan" | "emerald";
export type CrmNotificationType =
  | "retorno_hoje"
  | "retorno_atrasado"
  | "recompra_hoje"
  | "recompra_atrasada"
  | "agenda_hoje"
  | "alerta_manual"
  | "venda_recuperada"
  | "resumo_diario"
  | "sync_erro"
  | "teste";

export type PersistedCrmNotification = {
  id: string;
  title: string;
  description: string;
  tone: CrmNotificationTone;
  customerId?: string;
  view?: string;
  readAt?: string;
  createdAt: string;
};

export type NotificationDraft = {
  type: CrmNotificationType;
  title: string;
  description: string;
  tone: CrmNotificationTone;
  dedupeKey: string;
  userIds: string[];
  sellerId?: string;
  customerId?: string;
  view?: string;
  entityType?: string;
  entityId?: string;
  availableAt?: string;
  expiresAt?: string;
  sendPush?: boolean;
  payload?: Record<string, unknown>;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type NotificationRow = {
  id: string;
  tipo: CrmNotificationType;
  titulo: string;
  descricao: string;
  tom: CrmNotificationTone;
  destino_view: string | null;
  cliente_id: string | null;
  vendedor_id: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  dedupe_key: string;
  disponivel_em: string;
  expira_em: string | null;
  enviar_push: boolean;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type RecipientRow = {
  id: string;
  notificacao_id: string;
  usuario_id: string;
  vendedor_id: string | null;
  lida_em: string | null;
  limpa_em: string | null;
  enviada_push_em: string | null;
  erro_push: string | null;
  created_at: string;
};

export type CrmUserNotificationRow = {
  id: string;
  nome: string;
  email: string;
  perfil: CrmSessionUser["role"];
  vendedor_id: string | null;
  ativo: boolean;
};

export type PushSubscriptionRow = {
  id: string;
  usuario_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  ativo: boolean;
};

export class SupabaseCrmNotificationRepository {
  constructor(private readonly client = new SupabaseRestClient()) {}

  async listActiveUsers() {
    return this.client.select<CrmUserNotificationRow>("crm_usuarios", {
      select: "id,nome,email,perfil,vendedor_id,ativo",
      ativo: "eq.true",
      order: "nome.asc",
    });
  }

  async listForUser(userId: string): Promise<PersistedCrmNotification[]> {
    const recipients = await this.client.select<RecipientRow>("crm_notificacao_destinatarios", {
      select:
        "id,notificacao_id,usuario_id,vendedor_id,lida_em,limpa_em,enviada_push_em,erro_push,created_at",
      usuario_id: `eq.${userId}`,
      limpa_em: "is.null",
      order: "created_at.desc",
      limit: 60,
    });
    const notificationIds = [...new Set(recipients.map((row) => row.notificacao_id))];
    if (!notificationIds.length) return [];

    const notifications = await this.client.select<NotificationRow>("crm_notificacoes", {
      select:
        "id,tipo,titulo,descricao,tom,destino_view,cliente_id,vendedor_id,entidade_tipo,entidade_id,dedupe_key,disponivel_em,expira_em,enviar_push,payload,created_at",
      id: `in.(${notificationIds.join(",")})`,
      disponivel_em: `lte.${new Date().toISOString()}`,
      order: "created_at.desc",
      limit: 60,
    });
    const recipientByNotificationId = new Map(
      recipients.map((row) => [row.notificacao_id, row]),
    );

    return notifications
      .filter((notification) => {
        if (!notification.expira_em) return true;
        return notification.expira_em > new Date().toISOString();
      })
      .map((notification) => {
        const recipient = recipientByNotificationId.get(notification.id);
        return {
          id: notification.id,
          title: notification.titulo,
          description: notification.descricao,
          tone: notification.tom,
          customerId: notification.cliente_id ?? undefined,
          view: notification.destino_view ?? undefined,
          readAt: recipient?.lida_em ?? undefined,
          createdAt: notification.created_at,
        };
      });
  }

  async createNotifications(drafts: NotificationDraft[]) {
    const usefulDrafts = drafts.filter((draft) => draft.userIds.length > 0);
    if (!usefulDrafts.length) return { created: 0, recipients: 0 };

    const notificationRows = await this.client.upsert<NotificationRow>(
      "crm_notificacoes",
      usefulDrafts.map((draft) => ({
        tipo: draft.type,
        titulo: draft.title,
        descricao: draft.description,
        tom: draft.tone,
        destino_view: draft.view ?? null,
        cliente_id: draft.customerId ?? null,
        vendedor_id: draft.sellerId ?? null,
        entidade_tipo: draft.entityType ?? null,
        entidade_id: draft.entityId ?? null,
        dedupe_key: draft.dedupeKey,
        disponivel_em: draft.availableAt ?? new Date().toISOString(),
        expira_em: draft.expiresAt ?? null,
        enviar_push: draft.sendPush ?? true,
        payload: draft.payload ?? {},
      })),
      "dedupe_key",
    );

    const notificationByDedupe = new Map(
      notificationRows.map((row) => [row.dedupe_key, row]),
    );
    const recipientRows = usefulDrafts.flatMap((draft) => {
      const notification = notificationByDedupe.get(draft.dedupeKey);
      if (!notification) return [];
      return draft.userIds.map((userId) => ({
        notificacao_id: notification.id,
        usuario_id: userId,
        vendedor_id: draft.sellerId ?? null,
      }));
    });

    if (!recipientRows.length) return { created: notificationRows.length, recipients: 0 };

    await this.client.upsert<RecipientRow>(
      "crm_notificacao_destinatarios",
      recipientRows,
      "notificacao_id,usuario_id",
    );

    return { created: notificationRows.length, recipients: recipientRows.length };
  }

  async markAllCleared(userId: string) {
    await this.client.update<RecipientRow>(
      "crm_notificacao_destinatarios",
      { usuario_id: userId },
      { limpa_em: new Date().toISOString() },
    );
  }

  async markRead(userId: string, notificationId: string) {
    await this.client.update<RecipientRow>(
      "crm_notificacao_destinatarios",
      { usuario_id: userId, notificacao_id: notificationId },
      { lida_em: new Date().toISOString() },
    );
  }

  async savePushSubscription(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent: string,
  ) {
    await this.client.upsert<PushSubscriptionRow>(
      "crm_push_assinaturas",
      [{
        usuario_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
        ativo: true,
        ultimo_uso_em: new Date().toISOString(),
      }],
      "endpoint",
    );
    await this.resetPushErrorsForUser(userId);
  }

  async disablePushSubscription(userId: string, endpoint: string) {
    await this.client.update<PushSubscriptionRow>(
      "crm_push_assinaturas",
      { usuario_id: userId, endpoint },
      { ativo: false },
    );
  }

  async listPushSubscriptionsForUsers(userIds: string[]) {
    if (!userIds.length) return [];
    return this.client.select<PushSubscriptionRow>("crm_push_assinaturas", {
      select: "id,usuario_id,endpoint,p256dh,auth,ativo",
      usuario_id: `in.(${userIds.join(",")})`,
      ativo: "eq.true",
      limit: 1000,
    });
  }

  async markPushSent(recipientId: string) {
    await this.client.update<RecipientRow>(
      "crm_notificacao_destinatarios",
      { id: recipientId },
      { enviada_push_em: new Date().toISOString(), erro_push: null },
    );
  }

  async markPushError(recipientId: string, error: string) {
    await this.client.update<RecipientRow>(
      "crm_notificacao_destinatarios",
      { id: recipientId },
      { erro_push: error.slice(0, 300) },
    );
  }

  async resetPushErrorsForUser(userId: string) {
    const rows = await this.client.select<RecipientRow>("crm_notificacao_destinatarios", {
      select:
        "id,notificacao_id,usuario_id,vendedor_id,lida_em,limpa_em,enviada_push_em,erro_push,created_at",
      usuario_id: `eq.${userId}`,
      enviada_push_em: "is.null",
      erro_push: "not.is.null",
      limit: 100,
    });

    await Promise.all(
      rows.map((row) =>
        this.client.update<RecipientRow>(
          "crm_notificacao_destinatarios",
          { id: row.id },
          { erro_push: null },
        ),
      ),
    );
  }

  async listPendingPushRecipients(limit = 100) {
    return this.client.select<RecipientRow>("crm_notificacao_destinatarios", {
      select:
        "id,notificacao_id,usuario_id,vendedor_id,lida_em,limpa_em,enviada_push_em,erro_push,created_at",
      enviada_push_em: "is.null",
      erro_push: "is.null",
      limpa_em: "is.null",
      order: "created_at.asc",
      limit,
    });
  }

  async listNotificationsByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.client.select<NotificationRow>("crm_notificacoes", {
      select:
        "id,tipo,titulo,descricao,tom,destino_view,cliente_id,vendedor_id,entidade_tipo,entidade_id,dedupe_key,disponivel_em,expira_em,enviar_push,payload,created_at",
      id: `in.(${ids.join(",")})`,
      enviar_push: "eq.true",
      limit: ids.length,
    });
  }
}

export function isMissingNotificationSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("crm_notificacoes") ||
    message.includes("crm_notificacao_destinatarios") ||
    message.includes("crm_push_assinaturas") ||
    message.includes("PGRST205") ||
    message.includes("42P01")
  );
}
