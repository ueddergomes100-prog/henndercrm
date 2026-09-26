import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";
import CatalogClient from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) redirect("/");

  return <CatalogClient userName={user.name} />;
}
