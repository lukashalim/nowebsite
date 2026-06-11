import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  fetchAdminUsageReport,
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

function ServiceTable({ service }: { service: ServiceUsageRow }) {
  const hasData = USAGE_SEGMENT_ORDER.some(
    (segment) => service.bySegment[segment].totalEvents > 0,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
                  <dt className="text-zinc-500 dark:text-zinc-400">{action}</dt>
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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Usage by user type
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {report.periodLabel}. CSV exports are keyed by email; CRM outreach
            is keyed by signed-in user. Pro CRM actions are not logged.
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

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
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
            CSV-only emails
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {report.audience.csvOnlyEmails.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Downloaded directory CSV without a matching account
          </p>
        </div>
      </section>

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
