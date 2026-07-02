import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CrmSessionUser } from "@/domain/crm/types";

export const CRM_SESSION_COOKIE = "henndercrm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type DemoUser = CrmSessionUser & { password: string };

const fallbackDemoUsers: DemoUser[] = [
  {
    id: "demo-admin",
    name: "Administrador",
    email: "admin@henndercrm.local",
    password: "Admin@123",
    role: "administrador",
  },
  {
    id: "demo-supervisor",
    name: "Patricia Alves",
    email: "supervisor@henndercrm.local",
    password: "Supervisor@123",
    role: "supervisor",
  },
  {
    id: "demo-seller",
    name: "Daniel Bahia",
    email: "vendedor@henndercrm.local",
    password: "Vendedor@123",
    role: "vendedor",
    sellerId: "00000000-0000-4000-8000-0000a5c4bb4e",
  },
];

type SessionPayload = CrmSessionUser & { expiresAt: number };

type SupabasePasswordAuthResponse = {
  access_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

type CrmUserProfileRow = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  vendedor_id: string | null;
  ativo: boolean;
};

export async function authenticateCrmUser(
  email: string,
  password: string,
): Promise<CrmSessionUser | null> {
  if (isSupabaseAuthConfigured()) {
    return authenticateSupabaseUser(email, password);
  }

  return authenticateDemoUser(email, password);
}

export function authenticateDemoUser(email: string, password: string): CrmSessionUser | null {
  const demoUsers = resolveAuthUsers();
  const user = demoUsers.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user || !safeEqual(user.password, password)) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sellerId: user.sellerId,
  };
}

async function authenticateSupabaseUser(
  email: string,
  password: string,
): Promise<CrmSessionUser | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = getSupabaseClientApiKey();
  if (!baseUrl || !apiKey) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const authUrl = new URL("/auth/v1/token", baseUrl);
  authUrl.searchParams.set("grant_type", "password");

  const authResponse = await fetch(authUrl, {
    method: "POST",
    headers: supabaseHeaders(apiKey),
    body: JSON.stringify({
      email: normalizedEmail,
      password,
    }),
    cache: "no-store",
  });

  if (!authResponse.ok) return null;

  const authResult = (await authResponse.json()) as SupabasePasswordAuthResponse;
  const authUserId = authResult.user?.id;
  const accessToken = authResult.access_token;
  if (!authUserId || !accessToken) return null;

  const profileUrl = new URL("/rest/v1/crm_usuarios", baseUrl);
  profileUrl.searchParams.set(
    "select",
    "id,nome,email,perfil,vendedor_id,ativo",
  );
  profileUrl.searchParams.set("auth_user_id", `eq.${authUserId}`);
  profileUrl.searchParams.set("ativo", "eq.true");
  profileUrl.searchParams.set("limit", "1");

  const profileResponse = await fetch(profileUrl, {
    headers: supabaseHeaders(apiKey, accessToken),
    cache: "no-store",
  });

  if (!profileResponse.ok) return null;

  const [profile] = (await profileResponse.json()) as CrmUserProfileRow[];
  if (!profile || !isCrmUserRole(profile.perfil)) return null;

  return {
    id: profile.id,
    name: profile.nome,
    email: profile.email,
    role: profile.perfil,
    sellerId: profile.vendedor_id ?? undefined,
  };
}

function isSupabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseClientApiKey());
}

function getSupabaseClientApiKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function supabaseHeaders(apiKey: string, accessToken = apiKey) {
  return {
    apikey: apiKey,
    ...(accessToken !== apiKey ? { authorization: `Bearer ${accessToken}` } : {}),
    "content-type": "application/json",
  };
}

function isCrmUserRole(value: string): value is CrmSessionUser["role"] {
  return value === "administrador" || value === "supervisor" || value === "vendedor";
}

function resolveAuthUsers() {
  const configuredUsers = [
    authUserFromEnv("CRM_ADMIN", "demo-admin", "Administrador", "administrador"),
    authUserFromEnv("CRM_SUPERVISOR", "demo-supervisor", "Supervisor", "supervisor"),
    authUserFromEnv("CRM_SELLER", "demo-seller", "Vendedor", "vendedor"),
  ].filter((user): user is DemoUser => Boolean(user));

  if (configuredUsers.length > 0) return configuredUsers;
  if (process.env.NODE_ENV === "production") return [];
  return fallbackDemoUsers;
}

function authUserFromEnv(
  prefix: string,
  id: string,
  defaultName: string,
  role: CrmSessionUser["role"],
): DemoUser | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  if (!email || !password) return null;

  return {
    id,
    name: process.env[`${prefix}_NAME`]?.trim() || defaultName,
    email,
    password,
    role,
    sellerId: process.env[`${prefix}_SELLER_ID`]?.trim() || undefined,
  };
}

export function createSessionToken(user: CrmSessionUser) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readSessionToken(token?: string): CrmSessionUser | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.expiresAt <= Date.now()) return null;
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      sellerId: payload.sellerId,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.CRM_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function sign(value: string) {
  const secret =
    process.env.CRM_SESSION_SECRET ?? "henndercrm-local-development-secret-change-me";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
