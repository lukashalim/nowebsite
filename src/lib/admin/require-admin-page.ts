import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, canAccessAdmin } from "@/lib/admin/auth";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

export async function requireAdminPage(): Promise<void> {
  loadSharedEnvLocal();
  const headerStore = await headers();
  const cookieStore = await cookies();
  const host = headerStore.get("host");
  const access = await canAccessAdmin({
    host,
    token: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  });
  if (access === "allow") return;
  if (access === "login") redirect("/admin/login");
  notFound();
}
