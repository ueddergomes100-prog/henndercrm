import { cookies } from "next/headers";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) {
    return Response.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (user.role !== "administrador") {
    return Response.json(
      { error: "Somente administradores podem preparar a base." },
      { status: 403 },
    );
  }

  try {
    const { crmSupabaseBootstrapService } = await import(
      "@/services/crm-supabase-bootstrap-service"
    );
    return Response.json(await crmSupabaseBootstrapService.run());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao preparar o Supabase.",
      },
      { status: 500 },
    );
  }
}
