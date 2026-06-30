import { cookies } from "next/headers";
import type { CrmSessionUser, CrmUserRole } from "@/domain/crm/types";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";

type CrmUserRow = {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  perfil: CrmUserRole;
  vendedor_id: string | null;
  ativo: boolean;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
};

type CreateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: CrmUserRole;
  sellerId?: string;
};

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof Response) return user;

  try {
    const users = await supabaseRequest<CrmUserRow[]>(
      "/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo&order=nome.asc",
    );

    return Response.json({
      users: users.map(toResponseUser),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar usuarios." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (user instanceof Response) return user;

  const body = (await request.json()) as CreateUserBody;
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const role = body.role;
  const sellerId = body.sellerId?.trim();

  if (!name || !email || !password || !isCrmUserRole(role)) {
    return Response.json({ error: "Preencha nome, email, senha e perfil." }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }

  if (role === "vendedor" && !sellerId) {
    return Response.json({ error: "Vincule um vendedor para o perfil vendedor." }, { status: 400 });
  }

  try {
    const authUser = await createAuthUser(email, password, name);
    const [profile] = await supabaseRequest<CrmUserRow[]>("/rest/v1/crm_usuarios?on_conflict=email", {
      method: "POST",
      body: [
        {
          auth_user_id: authUser.id,
          nome: name,
          email,
          perfil: role,
          vendedor_id: role === "vendedor" ? sellerId : null,
          ativo: true,
        },
      ],
      prefer: "resolution=merge-duplicates,return=representation",
    });

    return Response.json({ user: toResponseUser(profile) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao cadastrar usuario." },
      { status: 400 },
    );
  }
}

async function requireAdmin(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "Sessao expirada." }, { status: 401 });
  if (user.role !== "administrador") {
    return Response.json({ error: "Somente administradores podem gerenciar usuarios." }, { status: 403 });
  }
  return user;
}

async function createAuthUser(email: string, password: string, name: string) {
  const existing = await getAuthUserByEmail(email);
  if (existing) return existing;

  return supabaseRequest<SupabaseAuthUser>("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    },
  });
}

async function getAuthUserByEmail(email: string) {
  const encodedEmail = encodeURIComponent(email);
  const result = await supabaseRequest<{ users?: SupabaseAuthUser[] }>(
    `/auth/v1/admin/users?email=${encodedEmail}`,
  );
  return result.users?.find((item) => item.email?.toLowerCase() === email) ?? null;
}

async function supabaseRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !secretKey) {
    throw new Error("Supabase nao configurado.");
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers: {
      apikey: secretKey,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `Supabase ${response.status}`);
  }

  if (!responseText) return [] as T;
  return JSON.parse(responseText) as T;
}

function toResponseUser(user: CrmUserRow) {
  return {
    id: user.id,
    authUserId: user.auth_user_id,
    name: user.nome,
    email: user.email,
    role: user.perfil,
    sellerId: user.vendedor_id,
    active: user.ativo,
  };
}

function isCrmUserRole(value: unknown): value is CrmUserRole {
  return value === "administrador" || value === "supervisor" || value === "vendedor";
}
