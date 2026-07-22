import { cookies } from "next/headers";
import { SupabaseRestClient } from "@/infrastructure/supabase/supabase-rest-client";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import { invalidateCrmSnapshotCache } from "@/lib/crm-snapshot-cache";

type ProductConfigBody = {
  id?: string;
  defaultRepurchaseDays?: number | null;
};

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "Sessao expirada." }, { status: 401 });
  if (user.role === "vendedor") {
    return Response.json({ error: "Somente administrador ou supervisor pode alterar regras." }, { status: 403 });
  }

  const body = (await request.json()) as ProductConfigBody;
  const id = body.id?.trim();
  if (!id) return Response.json({ error: "Informe o produto." }, { status: 400 });

  const days = Number(body.defaultRepurchaseDays);
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.round(days) : null;
  if (normalizedDays !== null && normalizedDays > 730) {
    return Response.json({ error: "Use ate 730 dias para a recompra." }, { status: 400 });
  }

  try {
    const client = new SupabaseRestClient();
    const [product] = await client.update<{
      id: string;
      dias_recompra_padrao: number | null;
    }>("crm_produtos", { id }, {
      dias_recompra_padrao: normalizedDays,
      recompra_ativa: normalizedDays !== null,
    });

    const generatedAlerts = await client.select<{ id: string; origem: string }>(
      "crm_alertas_recompra",
      {
        select: "id,origem",
        produto_id: `eq.${id}`,
      },
    );
    for (const alert of generatedAlerts) {
      if (alert.origem !== "manual") {
        await client.delete("crm_alertas_recompra", { id: alert.id });
      }
    }
    invalidateCrmSnapshotCache();

    return Response.json({
      id: product.id,
      defaultRepurchaseDays: product.dias_recompra_padrao,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar produto." },
      { status: 400 },
    );
  }
}
