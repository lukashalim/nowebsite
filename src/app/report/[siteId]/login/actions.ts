"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClientSiteById } from "@/lib/client-sites";
import {
  REPORT_COOKIE_NAME,
  createReportSessionToken,
  getReportPassword,
  reportCookieOptions,
  reportLoginPath,
  reportPasswordsMatch,
  reportPath,
  safeReportNextPath,
} from "@/lib/client-report/auth";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

function loginRedirect(
  siteId: string,
  nextPath: string,
  error?: "invalid" | "rate_limit",
): never {
  const sp = new URLSearchParams();
  if (nextPath !== reportPath(siteId)) sp.set("next", nextPath);
  if (error) sp.set("error", error);
  const q = sp.toString();
  const base = reportLoginPath(siteId);
  redirect(q ? `${base}?${q}` : base);
}

export async function loginClientReport(formData: FormData): Promise<void> {
  loadSharedEnvLocal();
  const siteId =
    typeof formData.get("siteId") === "string"
      ? String(formData.get("siteId"))
      : "";
  const site = getClientSiteById(siteId);
  if (!site) {
    redirect("/");
  }

  const nextPath = safeReportNextPath(
    site.id,
    typeof formData.get("next") === "string"
      ? String(formData.get("next"))
      : null,
  );

  if (!getReportPassword(site.id)) {
    loginRedirect(site.id, nextPath, "invalid");
  }

  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);
  const rateLimit = await checkRateLimit(
    "clientReportLogin",
    ip,
    headerStore.get("user-agent"),
  );
  if (!rateLimit.success) {
    loginRedirect(site.id, nextPath, "rate_limit");
  }

  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  if (!(await reportPasswordsMatch(site.id, password))) {
    loginRedirect(site.id, nextPath, "invalid");
  }

  const token = await createReportSessionToken(site.id);
  if (!token) {
    loginRedirect(site.id, nextPath, "invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(REPORT_COOKIE_NAME, token, reportCookieOptions());
  redirect(nextPath);
}
