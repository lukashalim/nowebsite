import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { loginClientReport } from "@/app/report/[siteId]/login/actions";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth";
import {
  REPORT_COOKIE_NAME,
  canAccessClientReport,
  reportPath,
  safeReportNextPath,
} from "@/lib/client-report/auth";
import { getClientSiteById } from "@/lib/client-sites";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site report",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ClientReportLoginPage({
  params,
  searchParams,
}: PageProps) {
  loadSharedEnvLocal();
  const { siteId } = await params;
  const site = getClientSiteById(siteId);
  if (!site) notFound();

  const headerStore = await headers();
  const cookieStore = await cookies();
  const raw = await searchParams;
  const nextPath = safeReportNextPath(site.id, firstParam(raw.next));
  const access = await canAccessClientReport({
    siteId: site.id,
    host: headerStore.get("host"),
    reportToken: cookieStore.get(REPORT_COOKIE_NAME)?.value,
    adminToken: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  });

  if (access === "allow") redirect(nextPath);
  if (access === "not_found") notFound();

  const error = firstParam(raw.error);
  const errorMessage =
    error === "rate_limit"
      ? "Too many attempts. Try again later."
      : error === "invalid"
        ? "Sign-in failed."
        : null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {site.name}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Website report
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Enter the password to see call clicks and visits.
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <form action={loginClientReport} className="mt-6 space-y-4">
        <input type="hidden" name="siteId" value={site.id} />
        <input type="hidden" name="next" value={nextPath} />
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
