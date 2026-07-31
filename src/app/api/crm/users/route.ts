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
  mensagem_whatsapp?: string | null;
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
  whatsAppMessage?: string;
};

type UpdateUserBody = {
  id?: string;
  name?: string;
  role?: CrmUserRole;
  sellerId?: string | null;
  password?: string;
  whatsAppMessage?: string | null;
};

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof Response) return user;

  try {
    const users = await listCrmUsers();

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
  const currentUser = await requireAuthenticatedUser();
  if (currentUser instanceof Response) return currentUser;

  const body = (await request.json()) as UpdateUserBody;
  const id = body.id?.trim();
  const name = body.name?.trim();
  const role = body.role;
  const hasSellerId = Object.prototype.hasOwnProperty.call(body, "sellerId");
  const sellerId = body.sellerId?.trim() || null;
  const password = body.password?.trim();
  const hasWhatsAppMessage = Object.prototype.hasOwnProperty.call(body, "whatsAppMessage");
  const whatsAppMessage = body.whatsAppMessage?.trim() || null;
  const updatesProfileFields =
    body.name !== undefined ||
    body.role !== undefined ||
    hasSellerId ||
    body.password !== undefined;

  if (!id) {
    return Response.json({ error: "Informe o usuario." }, { status: 400 });
  }
  if (
    currentUser.role !== "administrador" &&
    (id !== currentUser.id || updatesProfileFields || !hasWhatsAppMessage)
  ) {
    return Response.json(
      { error: "Voce pode alterar somente a sua mensagem automatica." },
      { status: 403 },
    );
  }
  if (body.name !== undefined && !name) {
    return Response.json({ error: "Informe o nome do usuario." }, { status: 400 });
  }
  if (role !== undefined && !isCrmUserRole(role)) {
    return Response.json({ error: "Perfil invalido." }, { status: 400 });
  }
  if (role === "vendedor" && !sellerId) {
    return Response.json({ error: "Vincule um vendedor para o perfil vendedor." }, { status: 400 });
  }
  if (password && password.length < 8) {
    return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (whatsAppMessage && whatsAppMessage.length > 1500) {
    return Response.json({ error: "A mensagem deve ter no maximo 1500 caracteres." }, { status: 400 });
  }

  try {
    const [target] = await supabaseRequest<CrmUserRow[]>(
      `/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!target) return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    if (!target.ativo) return Response.json({ error: "Usuario inativo nao pode ser editado." }, { status: 400 });
    if (target.perfil === "administrador" && role && role !== "administrador") {
      return Response.json({ error: "Administradores nao podem ser rebaixados." }, { status: 400 });
    }
    if (target.id === currentUser.id && role && role !== "administrador") {
      return Response.json({ error: "Voce nao pode remover seu proprio perfil administrador." }, { status: 400 });
    }

    const profilePatch = {
      ...(name !== undefined ? { nome: name } : {}),
      ...(role !== undefined
        ? {
            perfil: role,
            vendedor_id: role === "vendedor" ? sellerId : null,
          }
        : hasSellerId
          ? { vendedor_id: sellerId }
          : {}),
      ...(hasWhatsAppMessage ? { mensagem_whatsapp: whatsAppMessage } : {}),
    };

    if (Object.keys(profilePatch).length === 0 && !password) {
      return Response.json({ error: "Informe pelo menos uma alteracao." }, { status: 400 });
    }

    const [updatedProfile] = Object.keys(profilePatch).length
      ? await supabaseRequest<CrmUserRow[]>(`/rest/v1/crm_usuarios?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: profilePatch,
          prefer: "return=representation",
        })
      : [target];
    if (!updatedProfile) throw new Error("Usuario nao retornado apos atualizacao.");
    if (name !== undefined || password) {
      await updateAuthUser(target.auth_user_id, {
        name,
        password,
      });
    }

    const responseUser = toResponseUser(updatedProfile);
    const sessionUser = updatedProfile.id === currentUser.id
      ? {
          ...currentUser,
          name: updatedProfile.nome,
          role: updatedProfile.perfil,
          sellerId: updatedProfile.vendedor_id ?? undefined,
          whatsAppMessage: updatedProfile.mensagem_whatsapp?.trim() || undefined,
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
  const user = await requireAuthenticatedUser();
  if (user instanceof Response) return user;
  if (user.role !== "administrador") {
    return Response.json({ error: "Somente administradores podem gerenciar usuarios." }, { status: 403 });
  }
  return user;
}

async function requireAuthenticatedUser(): Promise<CrmSessionUser | Response> {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "Sessao expirada." }, { status: 401 });
  return user;
}

async function listCrmUsers() {
  try {
    return await supabaseRequest<CrmUserRow[]>(
      "/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo,mensagem_whatsapp&order=nome.asc",
    );
  } catch {
    return supabaseRequest<CrmUserRow[]>(
      "/rest/v1/crm_usuarios?select=id,auth_user_id,nome,email,perfil,vendedor_id,ativo&order=nome.asc",
    );
  }
}

async function deleteAuthUser(authUserId: string) {
  if (!authUserId) return;
  await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "DELETE",
  });
}

async function updateAuthUser(
  authUserId: string,
  values: { name?: string; password?: string },
) {
  if (!authUserId) return;
  const body = {
    ...(values.name ? { user_metadata: { name: values.name } } : {}),
    ...(values.password ? { password: values.password } : {}),
  };
  if (Object.keys(body).length === 0) return;
  await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "PUT",
    body,
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
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
      authorization: `Bearer ${secretKey}`,
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
    whatsAppMessage: user.mensagem_whatsapp?.trim() || undefined,
  };
}

function isCrmUserRole(value: unknown): value is CrmUserRole {
  return value === "administrador" || value === "supervisor" || value === "vendedor";
}
