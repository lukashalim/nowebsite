import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import {
  demoCohortTotalPages,
  fetchDemoCohortPage,
} from "@/lib/crm-cohort";
import { demoPublicPath } from "@/lib/demo-slug";
import { salesSummaryOneLine } from "@/lib/demo-enrichment";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Local business demo sites",
    description:
      "Demo sites for no-website leads that have extracted review excerpts (Maps pipeline).",
  };
}

const DEFAULT_PAGE_SIZE = 48;

interface DemoIndexProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export default async function DemoIndex({ searchParams }: DemoIndexProps) {
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(
        raw.pageSize ?? String(DEFAULT_PAGE_SIZE),
        10,
      ) || DEFAULT_PAGE_SIZE,
    ),
  );

  const { rows, total } = await fetchDemoCohortPage(page, pageSize);
  const totalPages = demoCohortTotalPages(total, pageSize);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (p !== 1) sp.set("page", String(p));
    if (pageSize !== DEFAULT_PAGE_SIZE) sp.set("pageSize", String(pageSize));
    const q = sp.toString();
    return q ? `/demo?${q}` : "/demo";
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Demo landing pages
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Same cohort as the CRM, but only businesses with stored review excerpts.
          No website, 4+ stars, 25–199 reviews. Open a row for the demo layout.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          {total} total
          {totalPages > 1
            ? ` · Page ${page} of ${totalPages}`
            : null}
        </p>
      </header>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-zinc-500">
            No businesses match the demo cohort.
          </li>
        ) : (
          rows.map((b) => {
            const href = demoPublicPath(b);
            const loc =
              [b.city, b.state, b.postal_code].filter(Boolean).join(", ") ||
              b.address ||
              "";
            const blurb = salesSummaryOneLine(b.enrichment ?? null);
            return (
              <li key={b.place_id}>
                <Link
                  href={href}
                  className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-start sm:justify-between dark:hover:bg-zinc-900/60"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                      {b.name ?? "Business"}
                    </span>
                    {blurb ? (
                      <span className="block whitespace-normal text-xs text-zinc-500 dark:text-zinc-400">
                        {blurb}
                      </span>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {loc ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        {loc}
                      </span>
                    ) : null}
                    {b.rating != null ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star
                          className="size-3.5 fill-amber-400 text-amber-400"
                          aria-hidden
                        />
                        {Number(b.rating).toFixed(1)}
                        {b.reviews != null ? ` (${b.reviews})` : ""}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      {totalPages > 1 ? (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Previous
            </Link>
          ) : null}
          <span className="px-2 text-zinc-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
