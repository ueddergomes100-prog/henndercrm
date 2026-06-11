import { cookies } from "next/headers";
import {
  authenticateDemoUser,
  createSessionToken,
  CRM_SESSION_COOKIE,
  readSessionToken,
  sessionCookieOptions,
} from "@/lib/crm-auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  return Response.json({ user });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const user = authenticateDemoUser(body.email ?? "", body.password ?? "");
  if (!user) {
    return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(CRM_SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
  return Response.json({ user });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(CRM_SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return Response.json({ ok: true });
}
