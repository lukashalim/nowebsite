import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth";
import {
  REPORT_COOKIE_NAME,
  canAccessClientReport,
  reportLoginPath,
} from "@/lib/client-report/auth";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

export async function requireClientReportPage(siteId: string): Promise<void> {
  loadSharedEnvLocal();
  const headerStore = await headers();
  const cookieStore = await cookies();
  const access = await canAccessClientReport({
    siteId,
    host: headerStore.get("host"),
    reportToken: cookieStore.get(REPORT_COOKIE_NAME)?.value,
    adminToken: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  });
  if (access === "allow") return;
  if (access === "login") redirect(reportLoginPath(siteId));
  notFound();
}
