import { cookies } from "next/headers";
import type {
  CrmAgendaEvent,
  CrmContactRecord,
  CrmOpportunity,
  CrmSessionUser,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import { getCrmWorkspaceRepository } from "@/infrastructure/crm-workspace-provider";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import { crmDemoService } from "@/services/crm-demo-service";

type WorkspaceAction =
  | { action: "create_contact"; record: Omit<CrmContactRecord, "id"> }
  | { action: "update_alert"; id: string; status: RepurchaseAlertStatus }
  | { action: "create_agenda"; event: Omit<CrmAgendaEvent, "id"> }
  | { action: "update_agenda"; id: string; event: Partial<Omit<CrmAgendaEvent, "id">> }
  | { action: "delete_agenda"; id: string }
  | { action: "create_opportunity"; opportunity: Omit<CrmOpportunity, "id"> }
  | {
      action: "update_opportunity";
      id: string;
      opportunity: Partial<Omit<CrmOpportunity, "id">>;
    }
  | { action: "delete_opportunity"; id: string };

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const workspace = await getCrmWorkspaceRepository().getWorkspace();
  if (user.role !== "vendedor" || !user.sellerId) return Response.json(workspace);

  const snapshot = crmDemoService.getSnapshot();
  const allowedSellerId = resolveSnapshotSellerId(user.sellerId);
  const customerIds = getSellerCustomerIds(allowedSellerId);
  const alertIds = new Set(
    snapshot.alerts
      .filter((alert) => alert.sellerId === allowedSellerId)
      .map((alert) => alert.id),
  );

  return Response.json({
    contacts: workspace.contacts.filter((contact) => customerIds.has(contact.customerId)),
    alertStatuses: Object.fromEntries(
      Object.entries(workspace.alertStatuses).filter(([id]) => alertIds.has(id)),
    ),
    agenda: workspace.agenda.filter((event) => event.sellerId === allowedSellerId),
    opportunities: workspace.opportunities.filter(
      (opportunity) => opportunity.sellerId === allowedSellerId,
    ),
  });
}

function getSellerCustomerIds(sellerId: string) {
  const snapshot = crmDemoService.getSnapshot();
  const customerIds = new Set<string>();

  for (const customer of snapshot.customers) {
    const preferredSeller = snapshot.sellers.find(
      (seller) => seller.uniplusId === customer.preferredSeller?.sellerId,
    );
    if (preferredSeller?.id === sellerId) customerIds.add(customer.id);
  }

  for (const sale of snapshot.sales) {
    if (sale.sellerId === sellerId) customerIds.add(sale.customerId);
  }

  for (const alert of snapshot.alerts) {
    if (alert.sellerId === sellerId) customerIds.add(alert.customerId);
  }

  return customerIds;
}

function resolveSnapshotSellerId(sellerId: string) {
  const snapshot = crmDemoService.getSnapshot();
  if (snapshot.sellers.some((seller) => seller.id === sellerId)) return sellerId;
  if (!snapshot.sellers.length) return sellerId;

  const hash = [...sellerId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return snapshot.sellers[hash % snapshot.sellers.length].id;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  try {
    const command = (await request.json()) as WorkspaceAction;
    const repository = getCrmWorkspaceRepository();
    const denied = await denyUnauthorizedChange(user, command, repository);
    if (denied) return denied;

    switch (command.action) {
      case "create_contact":
        return Response.json(
          await repository.createContact(command.record),
          { status: 201 },
        );
      case "update_alert":
        return Response.json(
          await repository.updateAlertStatus(command.id, command.status),
        );
      case "create_agenda":
        return Response.json(
          await repository.createAgendaEvent(command.event),
          { status: 201 },
        );
      case "update_agenda":
        return Response.json(
          await repository.updateAgendaEvent(command.id, command.event),
        );
      case "delete_agenda":
        await repository.deleteAgendaEvent(command.id);
        return Response.json({ ok: true });
      case "create_opportunity":
        return Response.json(
          await repository.createOpportunity(command.opportunity),
          { status: 201 },
        );
      case "update_opportunity":
        return Response.json(
          await repository.updateOpportunity(
            command.id,
            command.opportunity,
          ),
        );
      case "delete_opportunity":
        await repository.deleteOpportunity(command.id);
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar alteração." },
      { status: 400 },
    );
  }
}

async function requireUser(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  return user ?? Response.json({ error: "Sessão expirada." }, { status: 401 });
}

async function denyUnauthorizedChange(
  user: CrmSessionUser,
  command: WorkspaceAction,
  repository: ReturnType<typeof getCrmWorkspaceRepository>,
) {
  if (user.role !== "vendedor") return null;
  if (!user.sellerId) {
    return Response.json({ error: "Vendedor sem carteira vinculada." }, { status: 403 });
  }

  const snapshot = crmDemoService.getSnapshot();
  const workspace = await repository.getWorkspace();
  const allowedSellerId = resolveSnapshotSellerId(user.sellerId);
  let assignedSellerId: string | undefined;

  switch (command.action) {
    case "create_contact":
      assignedSellerId = getSellerCustomerIds(allowedSellerId).has(command.record.customerId)
        ? allowedSellerId
        : undefined;
      break;
    case "update_alert":
      assignedSellerId = command.id.startsWith("manual-alert-")
        ? allowedSellerId
        : snapshot.alerts.find((alert) => alert.id === command.id)?.sellerId;
      break;
    case "create_agenda":
      assignedSellerId = command.event.sellerId;
      break;
    case "update_agenda":
    case "delete_agenda":
      assignedSellerId = workspace.agenda.find((event) => event.id === command.id)?.sellerId;
      break;
    case "create_opportunity":
      assignedSellerId = command.opportunity.sellerId;
      break;
    case "update_opportunity":
    case "delete_opportunity":
      assignedSellerId = workspace.opportunities.find(
        (item) => item.id === command.id,
      )?.sellerId;
      break;
  }

  return assignedSellerId === allowedSellerId
    ? null
    : Response.json(
        { error: "Esta ação pertence à carteira de outro vendedor." },
        { status: 403 },
      );
}
