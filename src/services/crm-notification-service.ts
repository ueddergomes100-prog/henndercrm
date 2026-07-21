import "server-only";

import type {
  CrmAgendaEvent,
  CrmRepurchaseAlert,
  CrmSessionUser,
  CrmSnapshot,
  CrmWorkspace,
} from "@/domain/crm/types";
import { getCrmWorkspaceRepository } from "@/infrastructure/crm-workspace-provider";
import {
  isMissingNotificationSchemaError,
  type CrmUserNotificationRow,
  type NotificationDraft,
  SupabaseCrmNotificationRepository,
} from "@/infrastructure/supabase/supabase-crm-notification-repository";
import { SupabaseCrmSnapshotRepository } from "@/infrastructure/supabase/supabase-crm-snapshot-repository";

const TIME_ZONE = "America/Sao_Paulo";
const FOLLOW_UP_NOTE_PREFIX = "crm_follow_up_contact:";
const PROCESS_TTL_MS = 5 * 60 * 1000;
let lastProcessAt = 0;
let lastProcessResult: NotificationProcessResult | undefined;
let pendingProcess: Promise<NotificationProcessResult> | undefined;

export type NotificationProcessResult = {
  ok: boolean;
  schemaReady: boolean;
  created: number;
  recipients: number;
  error?: string;
};

export async function processCrmNotifications(
  repository = new SupabaseCrmNotificationRepository(),
): Promise<NotificationProcessResult> {
  const now = Date.now();
  if (lastProcessResult && now - lastProcessAt < PROCESS_TTL_MS) return lastProcessResult;
  if (pendingProcess) return pendingProcess;

  pendingProcess = processCrmNotificationsNow(repository).finally(() => {
    pendingProcess = undefined;
  });
  lastProcessResult = await pendingProcess;
  lastProcessAt = Date.now();
  return lastProcessResult;
}

async function processCrmNotificationsNow(
  repository: SupabaseCrmNotificationRepository,
): Promise<NotificationProcessResult> {
  try {
    const [users, snapshot, workspace] = await Promise.all([
      repository.listActiveUsers(),
      new SupabaseCrmSnapshotRepository().getSnapshot(),
      getCrmWorkspaceRepository().getWorkspace(),
    ]);
    const drafts = buildOperationalNotificationDrafts(users, snapshot, workspace);
    const result = await repository.createNotifications(drafts);
    return { ok: true, schemaReady: true, ...result };
  } catch (error) {
    if (isMissingNotificationSchemaError(error)) {
      return {
        ok: false,
        schemaReady: false,
        created: 0,
        recipients: 0,
        error: "As tabelas de notificacao ainda nao existem no Supabase.",
      };
    }

    return {
      ok: false,
      schemaReady: true,
      created: 0,
      recipients: 0,
      error: error instanceof Error ? error.message : "Falha ao processar notificacoes.",
    };
  }
}

export async function createTestNotificationForAllUsers(
  actor: CrmSessionUser,
  repository = new SupabaseCrmNotificationRepository(),
) {
  const users = await repository.listActiveUsers();
  const today = todayInSaoPaulo();
  const createdAt = new Date().toISOString();
  return repository.createNotifications([
    {
      type: "teste",
      title: "Teste de notificacao do Hennder CRM",
      description: `Notificacao enviada por ${actor.name} para validar sino e push individual.`,
      tone: "cyan",
      view: "dashboard",
      dedupeKey: `teste-geral:${today}:${Date.now()}`,
      userIds: users.map((user) => user.id),
      sendPush: true,
      payload: { actorId: actor.id, createdAt },
    },
  ]);
}

function buildOperationalNotificationDrafts(
  users: CrmUserNotificationRow[],
  snapshot: CrmSnapshot,
  workspace: CrmWorkspace,
): NotificationDraft[] {
  const today = todayInSaoPaulo();
  const usersBySellerId = new Map<string, CrmUserNotificationRow[]>();

  for (const user of users) {
    if (!user.vendedor_id) continue;
    const list = usersBySellerId.get(user.vendedor_id) ?? [];
    list.push(user);
    usersBySellerId.set(user.vendedor_id, list);
  }

  const drafts: NotificationDraft[] = [];

  for (const event of workspace.agenda) {
    if (event.completed || !event.sellerId) continue;
    const recipients = usersBySellerId.get(event.sellerId) ?? [];
    if (!recipients.length) continue;

    if (isAutomaticFollowUp(event) && event.date <= today) {
      const overdue = event.date < today;
      drafts.push({
        type: overdue ? "retorno_atrasado" : "retorno_hoje",
        title: overdue ? `Retorno atrasado: ${cleanFollowUpTitle(event.title)}` : `Retorno hoje: ${cleanFollowUpTitle(event.title)}`,
        description: overdue
          ? `O retorno estava marcado para ${formatDate(event.date)} as ${event.time}.`
          : `Contato combinado para hoje as ${event.time}.`,
        tone: overdue ? "red" : "amber",
        customerId: event.customerId,
        sellerId: event.sellerId,
        view: "agenda",
        entityType: "agenda",
        entityId: event.id,
        dedupeKey: `${overdue ? "retorno-atrasado" : "retorno-hoje"}:${today}:${event.id}`,
        userIds: recipients.map((user) => user.id),
      });
      continue;
    }

    if (event.date === today) {
      drafts.push({
        type: "agenda_hoje",
        title: `${event.time} - ${event.title}`,
        description: `Compromisso de ${event.type.toLowerCase()} na agenda comercial.`,
        tone: "emerald",
        customerId: event.customerId,
        sellerId: event.sellerId,
        view: "agenda",
        entityType: "agenda",
        entityId: event.id,
        dedupeKey: `agenda-hoje:${today}:${event.id}`,
        userIds: recipients.map((user) => user.id),
      });
    }
  }

  const pendingAlerts = snapshot.alerts.filter((alert) => alert.status === "pendente");
  for (const alert of pendingAlerts) {
    if (!alert.sellerId || alert.expectedDate > today) continue;
    const recipients = usersBySellerId.get(alert.sellerId) ?? [];
    if (!recipients.length) continue;
    drafts.push(alertNotificationDraft(alert, today, recipients));
  }

  return drafts;
}

function alertNotificationDraft(
  alert: CrmRepurchaseAlert,
  today: string,
  recipients: CrmUserNotificationRow[],
): NotificationDraft {
  const overdue = alert.expectedDate < today;
  return {
    type: overdue ? "recompra_atrasada" : "recompra_hoje",
    title: overdue ? `Recompra atrasada: ${alert.customerName}` : `Recompra hoje: ${alert.customerName}`,
    description: `${alert.productName} previsto para ${formatDate(alert.expectedDate)}.`,
    tone: overdue ? "red" : "amber",
    customerId: alert.customerId,
    sellerId: alert.sellerId,
    view: "recuperacao",
    entityType: "alerta",
    entityId: alert.id,
    dedupeKey: `${overdue ? "recompra-atrasada" : "recompra-hoje"}:${today}:${alert.id}`,
    userIds: recipients.map((user) => user.id),
  };
}

function isAutomaticFollowUp(event: CrmAgendaEvent) {
  return event.type === "Retorno" && event.note?.startsWith(FOLLOW_UP_NOTE_PREFIX);
}

function cleanFollowUpTitle(title: string) {
  return title.replace(/^Retorno:\s*/u, "") || "Cliente";
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
