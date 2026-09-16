import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getClientSiteById } from "@/lib/client-sites";
import {
  fetchClientSiteReportCounts,
  type ClientSiteReportCounts,
} from "@/lib/client-report/events";
import {
  formatReportMonthLabel,
  formatReportYearLabel,
} from "@/lib/client-report/periods";
import { requireClientReportPage } from "@/lib/client-report/require-report-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ siteId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { siteId } = await params;
  const site = getClientSiteById(siteId);
  return {
    title: site ? `${site.name} report` : "Website report",
    robots: { index: false, follow: false },
  };
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

const EMPTY_COUNTS: ClientSiteReportCounts = {
  callsMonth: 0,
  callsYtd: 0,
  visitsMonth: 0,
  visitsYtd: 0,
};

export default async function ClientReportPage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getClientSiteById(siteId);
  if (!site) notFound();

  await requireClientReportPage(site.id);

  const now = new Date();
  let counts = EMPTY_COUNTS;
  let error: string | null = null;
  try {
    counts = await fetchClientSiteReportCounts(site.id, now);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load counts.";
  }
  const monthLabel = formatReportMonthLabel(now);
  const yearLabel = formatReportYearLabel(now);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {site.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Website report
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Call button clicks and visits for {monthLabel} and {yearLabel} year
            to date. Periods use Eastern Time.
          </p>
        </div>
        <form action={`/report/${site.id}/logout`} method="post">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>

      {error ? (
        <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <Phone className="size-4" aria-hidden />
            Call clicks · {monthLabel}
          </p>
          <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatCount(counts.callsMonth)}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <Phone className="size-4" aria-hidden />
            Call clicks · {yearLabel} YTD
          </p>
          <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatCount(counts.callsYtd)}
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Visits · {monthLabel}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatCount(counts.visitsMonth)}
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Visits · {yearLabel} YTD
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatCount(counts.visitsYtd)}
          </p>
        </article>
      </section>

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        Visits are page loads from a browser. Search crawlers and scripts are
        excluded, but some bot traffic can still inflate this number. Call
        clicks are the better signal.
      </p>
    </main>
  );
}
