import { cookies } from "next/headers";
import type { CrmSessionUser, CrmUserRole } from "@/domain/crm/types";
import {
  createSessionToken,
  CRM_SESSION_COOKIE,
  readSessionToken,
  sessionCookieOptions,
} from "@/lib/crm-auth";

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

type UpdateUserBody = {
  id?: string;
  name?: string;
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

export async function PATCH(request: Request) {
  const currentUser = await requireAdmin();
  if (currentUser instanceof Response) return currentUser;

  const body = (await request.json()) as UpdateUserBody;
  const id = body.id?.trim();
  const name = body.name?.trim();

  if (!id || !name) {
    return Response.json({ error: "Informe usuario e nome." }, { status: 400 });
  }

  try {
    const [target] = await supabaseRequest<CrmUserRow[]>(
      `/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!target) return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    if (!target.ativo) return Response.json({ error: "Usuario inativo nao pode ser editado." }, { status: 400 });

    const [updated] = await supabaseRequest<CrmUserRow[]>(`/rest/v1/crm_usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { nome: name },
      prefer: "return=representation",
    });
    if (!updated) throw new Error("Usuario nao retornado apos atualizacao.");
    await updateAuthUserMetadata(target.auth_user_id, name);

    const responseUser = toResponseUser(updated);
    const sessionUser = updated.id === currentUser.id
      ? {
          ...currentUser,
          name: updated.nome,
        }
      : undefined;

    if (sessionUser) {
      const cookieStore = await cookies();
      cookieStore.set(CRM_SESSION_COOKIE, createSessionToken(sessionUser), sessionCookieOptions());
    }

    return Response.json({ user: responseUser, sessionUser });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar usuario." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Informe o usuario." }, { status: 400 });
  if (id === user.id) {
    return Response.json({ error: "Voce nao pode excluir o proprio usuario." }, { status: 400 });
  }

  try {
    const [target] = await supabaseRequest<CrmUserRow[]>(
      `/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!target) return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    if (target.perfil === "administrador") {
      return Response.json({ error: "Administradores nao podem ser excluidos." }, { status: 400 });
    }

    await supabaseRequest<CrmUserRow[]>(`/rest/v1/crm_usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { ativo: false },
      prefer: "return=minimal",
    });
    await deleteAuthUser(target.auth_user_id);

    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao excluir usuario." },
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

async function deleteAuthUser(authUserId: string) {
  if (!authUserId) return;
  await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "DELETE",
  });
}

async function updateAuthUserMetadata(authUserId: string, name: string) {
  if (!authUserId) return;
  await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "PATCH",
    body: {
      user_metadata: { name },
    },
  });
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
