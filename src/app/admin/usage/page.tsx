import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  fetchAdminUsageReport,
  USAGE_EVENT_LABELS,
  USAGE_SEGMENT_LABELS,
  USAGE_SEGMENT_ORDER,
  type ServiceUsageRow,
  type SegmentUtilization,
  type UsageSegment,
} from "@/lib/admin/usage-stats";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usage by user type",
  robots: { index: false, follow: false },
};

const periodSchema = z.enum(["month", "all"]);

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatPct(n: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function SegmentCell({
  stats,
  showLimit,
  showOutreachLimit,
}: {
  stats: SegmentUtilization;
  showLimit: boolean;
  showOutreachLimit?: boolean;
}) {
  if (stats.uniqueActors === 0 && stats.totalEvents === 0) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }

  const displayLimit = showLimit || showOutreachLimit;

  return (
    <div className="space-y-1 text-sm tabular-nums">
      <p>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {stats.totalEvents.toLocaleString()}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {" "}
          events · {stats.uniqueActors.toLocaleString()} users
        </span>
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        avg {stats.avgEventsPerActor}/user
        {displayLimit && stats.limit !== null ? (
          <>
            {" "}
            · {stats.actorsAtLimit.toLocaleString()} at limit (
            {formatPct(stats.actorsAtLimit, stats.uniqueActors)})
          </>
        ) : null}
      </p>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatCompactDateTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SECTION_NAV_LINKS = [
  { id: "overview", label: "Overview" },
  { id: "anonymous-csv", label: "Anonymous CSV" },
  { id: "registered-users", label: "Registered users" },
  { id: "directory_csv", label: "Directory CSV" },
  { id: "crm_outreach", label: "CRM outreach" },
  { id: "crm_csv_export", label: "CRM export" },
] as const;

const sectionLinkClass =
  "text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

function SectionJumpNav() {
  return (
    <nav
      className="sticky top-0 z-10 -mx-4 mb-6 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2.5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95 sm:-mx-6 sm:px-6"
      aria-label="Page sections"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Jump to
        </span>
        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
          /
        </span>
        {SECTION_NAV_LINKS.map((link, index) => (
          <span key={link.id} className="inline-flex items-center gap-x-2">
            <a href={`#${link.id}`} className={sectionLinkClass}>
              {link.label}
            </a>
            {index < SECTION_NAV_LINKS.length - 1 ? (
              <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
                /
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </nav>
  );
}

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function AnonymousCsvTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof fetchAdminUsageReport>>["anonymousCsvByPage"];
}) {
  return (
    <section
      id="anonymous-csv"
      className="scroll-mt-20 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Anonymous directory CSV downloads
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {rows.length.toLocaleString()} page
          {rows.length === 1 ? "" : "s"} with downloads (not signed in)
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          No anonymous CSV downloads in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-2.5 font-medium">Page URL</th>
                <th className="px-4 py-2.5 font-medium">Downloads</th>
                <th className="px-4 py-2.5 font-medium">Last download</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.pageUrl}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td
                    className="max-w-xs px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200"
                    title={row.pageUrl}
                  >
                    {truncateUrl(row.pageUrl)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                    {row.downloadCount.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDateTime(row.lastDownloadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserActivityTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof fetchAdminUsageReport>>["userActivity"];
}) {
  return (
    <section
      id="registered-users"
      className="scroll-mt-20 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Registered users
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {rows.length.toLocaleString()} account
          {rows.length === 1 ? "" : "s"} · activity counts respect the period
          filter; login timestamps are profile-tracked (all-time)
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Pro outreach counts only include activity after pro logging was
          enabled.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          No registered users found.
        </p>
      ) : (
        <table className="w-full table-fixed text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="w-[18%] px-2.5 py-2 font-medium">Email</th>
              <th className="w-[5%] px-2 py-2 font-medium">Tier</th>
              <th className="w-[11%] px-2 py-2 font-medium">First login</th>
              <th className="w-[11%] px-2 py-2 font-medium">Last login</th>
              <th className="w-[7%] px-2 py-2 font-medium">Mktg</th>
              <th className="w-[5%] px-2 py-2 text-right font-medium">CSV</th>
              <th className="w-[6%] px-2 py-2 text-right font-medium">Logins</th>
              <th className="w-[5%] px-2 py-2 text-right font-medium">DM</th>
              <th className="w-[5%] px-2 py-2 text-right font-medium">SMS</th>
              <th className="w-[5%] px-2 py-2 text-right font-medium">Calls</th>
              <th className="w-[7%] px-2 py-2 text-right font-medium">Demo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.userId}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td
                  className="truncate px-2.5 py-2 text-zinc-800 dark:text-zinc-200"
                  title={row.email ?? undefined}
                >
                  {row.email ?? "—"}
                </td>
                <td className="px-2 py-2">
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      row.isPro
                        ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {row.isPro ? "Pro" : "Free"}
                  </span>
                </td>
                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                  {formatCompactDateTime(row.firstLogin)}
                </td>
                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                  {formatCompactDateTime(row.lastLogin ?? row.lastSignInAt)}
                </td>
                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                  {row.marketingOptIn ? "Yes" : "No"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.csvDownloadCount.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.loginCount.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.dmCount.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.smsCount.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.phoneCallCount.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.demoClickCount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ServiceTable({ service }: { service: ServiceUsageRow }) {
  const hasData = USAGE_SEGMENT_ORDER.some(
    (segment) => service.bySegment[segment].totalEvents > 0,
  );

  return (
    <section
      id={service.id}
      className="scroll-mt-20 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {service.label}
        </h2>
        {service.limitLabel ? (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {service.limitLabel}
          </p>
        ) : null}
        {service.note ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {service.note}
          </p>
        ) : null}
      </div>

      {!hasData && service.note?.includes("not logged") ? (
        <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          No usage data recorded for this service yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-2.5 font-medium">User type</th>
                <th className="px-4 py-2.5 font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {USAGE_SEGMENT_ORDER.map((segment: UsageSegment) => (
                <tr
                  key={segment}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                    {USAGE_SEGMENT_LABELS[segment]}
                  </td>
                  <td className="px-4 py-3">
                    <SegmentCell
                      stats={service.bySegment[segment]}
                      showLimit={
                        service.id === "directory_csv" &&
                        segment !== "paid"
                      }
                      showOutreachLimit={
                        service.id === "crm_outreach" &&
                        segment === "free_logged_in"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {service.actionBreakdown &&
      Object.keys(service.actionBreakdown).length > 0 ? (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            By action
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
            {Object.entries(service.actionBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => (
                <div key={action} className="flex gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    {USAGE_EVENT_LABELS[
                      action as keyof typeof USAGE_EVENT_LABELS
                    ] ?? action}
                  </dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {count.toLocaleString()}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export default async function AdminUsagePage({ searchParams }: PageProps) {
  const host = (await headers()).get("host");
  if (!isLocalAdminEnabled(host)) {
    notFound();
  }

  const raw = await searchParams;
  const parsedPeriod = periodSchema.safeParse(firstParam(raw.period));
  const period = parsedPeriod.success ? parsedPeriod.data : "month";
  const report = await fetchAdminUsageReport(period);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Usage by user type
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {report.periodLabel}. Directory CSV exports are logged by signed-in
            user or anonymous session. CRM outreach is keyed by signed-in user.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/scrape-progress"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Scrape progress
          </Link>
          <Link
            href="/admin/scrape"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Local scrape admin
          </Link>
        </nav>
      </div>

      <SectionJumpNav />

      <div className="mb-6 flex gap-2">
        <Link
          href="/admin/usage?period=month"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "month"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }`}
        >
          This month
        </Link>
        <Link
          href="/admin/usage?period=all"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            period === "all"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }`}
        >
          All time
        </Link>
      </div>

      {report.error ? (
        <p
          className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
          role="alert"
        >
          {report.error}
        </p>
      ) : null}

      <section
        id="overview"
        className="scroll-mt-20 mb-8 grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Free accounts
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {report.audience.registeredFree.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Pro accounts
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {report.audience.registeredPro.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Anonymous CSV exports
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {report.audience.csvOnlyEmails.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Directory CSV downloads without a signed-in account
          </p>
        </div>
      </section>

      <div className="mb-8 space-y-6">
        <AnonymousCsvTable rows={report.anonymousCsvByPage} />
        <UserActivityTable rows={report.userActivity} />
      </div>

      <div className="space-y-6">
        {report.services.map((service) => (
          <ServiceTable key={service.id} service={service} />
        ))}
      </div>

      <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-500">
        Generated {new Date(report.generatedAt).toLocaleString()}. Localhost-only
        admin — set ENABLE_LOCAL_ADMIN=1 to use on private hosts outside dev.
      </p>
    </main>
  );
}
