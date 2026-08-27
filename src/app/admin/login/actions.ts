"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  adminPasswordsMatch,
  createAdminSessionToken,
  getAdminPassword,
  safeAdminNextPath,
} from "@/lib/admin/auth";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

function loginRedirect(
  nextPath: string,
  error?: "invalid" | "rate_limit",
): never {
  const sp = new URLSearchParams();
  if (nextPath !== "/admin/purchases") sp.set("next", nextPath);
  if (error) sp.set("error", error);
  const q = sp.toString();
  redirect(q ? `/admin/login?${q}` : "/admin/login");
}

export async function loginAdmin(formData: FormData): Promise<void> {
  loadSharedEnvLocal();
  const nextPath = safeAdminNextPath(
    typeof formData.get("next") === "string"
      ? String(formData.get("next"))
      : null,
  );

  if (!getAdminPassword()) {
    loginRedirect(nextPath, "invalid");
  }

  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);
  const rateLimit = await checkRateLimit(
    "adminLogin",
    ip,
    headerStore.get("user-agent"),
  );
  if (!rateLimit.success) {
    loginRedirect(nextPath, "rate_limit");
  }

  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  if (!(await adminPasswordsMatch(password))) {
    loginRedirect(nextPath, "invalid");
  }

  const token = await createAdminSessionToken();
  if (!token) {
    loginRedirect(nextPath, "invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
  redirect(nextPath);
}
