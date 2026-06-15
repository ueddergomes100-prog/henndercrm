import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CrmSessionUser } from "@/domain/crm/types";

export const CRM_SESSION_COOKIE = "henndercrm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type DemoUser = CrmSessionUser & { password: string };

const demoUsers: DemoUser[] = [
  {
    id: "demo-admin",
    name: "Ana Administradora",
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

export function authenticateDemoUser(email: string, password: string): CrmSessionUser | null {
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
