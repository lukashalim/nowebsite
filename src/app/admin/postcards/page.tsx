import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  fetchAdminPostcardTracking,
  type PostcardTrackingMode,
  type PostcardTrackingPeriod,
  type PostcardTrackingStatus,
} from "@/lib/admin/postcard-tracking";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postcard tracking",
  robots: { index: false, follow: false },
};

const modeSchema = z.enum(["live", "test"]);
const periodSchema = z.enum(["month", "all"]);
const statusSchema = z.enum(["all", "scanned", "unscanned"]);

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function hrefFor(opts: {
  mode: PostcardTrackingMode;
  period: PostcardTrackingPeriod;
  status: PostcardTrackingStatus;
}): string {
  const sp = new URLSearchParams();
  sp.set("mode", opts.mode);
  sp.set("period", opts.period);
  if (opts.status !== "all") sp.set("status", opts.status);
  return `/admin/postcards?${sp.toString()}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function locationLine(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(", ");
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }
    >
      {children}
    </Link>
  );
}

export default async function AdminPostcardsPage({ searchParams }: PageProps) {
  const host = (await headers()).get("host");
  if (!isLocalAdminEnabled(host)) {
    notFound();
  }

  const raw = await searchParams;
  const mode = modeSchema.safeParse(firstParam(raw.mode)).success
    ? (firstParam(raw.mode) as PostcardTrackingMode)
    : "test";
  const period = periodSchema.safeParse(firstParam(raw.period)).success
    ? (firstParam(raw.period) as PostcardTrackingPeriod)
    : "month";
  const status = statusSchema.safeParse(firstParam(raw.status)).success
    ? (firstParam(raw.status) as PostcardTrackingStatus)
    : "all";

  const { rows, error } = await fetchAdminPostcardTracking({
    mode,
    period,
    status,
  });

  const scannedCount = rows.filter((r) => r.scannedAt).length;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Postcard tracking
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Each Lob postcard send with first QR scan (if any) and lead phone.
            Test vs production uses separate usage event types.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/usage"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Usage
          </Link>
          <Link
            href="/admin/scrape"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Scrape
          </Link>
          <Link
            href="/scrape-progress"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Scrape progress
          </Link>
        </nav>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Mode
          </span>
          <TabLink
            href={hrefFor({ mode: "test", period, status })}
            active={mode === "test"}
          >
            Test
          </TabLink>
          <TabLink
            href={hrefFor({ mode: "live", period, status })}
            active={mode === "live"}
          >
            Production
          </TabLink>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Period
          </span>
          <TabLink
            href={hrefFor({ mode, period: "month", status })}
            active={period === "month"}
          >
            This month
          </TabLink>
          <TabLink
            href={hrefFor({ mode, period: "all", status })}
            active={period === "all"}
          >
            All time
          </TabLink>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Status
          </span>
          <TabLink
            href={hrefFor({ mode, period, status: "all" })}
            active={status === "all"}
          >
            All
          </TabLink>
          <TabLink
            href={hrefFor({ mode, period, status: "scanned" })}
            active={status === "scanned"}
          >
            Scanned
          </TabLink>
          <TabLink
            href={hrefFor({ mode, period, status: "unscanned" })}
            active={status === "unscanned"}
          >
            Not scanned
          </TabLink>
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Showing {rows.length.toLocaleString()} send
        {rows.length === 1 ? "" : "s"}
        {status === "all"
          ? ` · ${scannedCount.toLocaleString()} scanned`
          : null}
        {" · "}
        {mode === "test" ? "Lob test key" : "Lob live key"} events
        {period === "month" ? " (this month UTC)" : ""}
        . Cap 200 newest.
      </p>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">Business</th>
              <th className="px-3 py-2.5 font-medium">Phone</th>
              <th className="px-3 py-2.5 font-medium">Sent</th>
              <th className="px-3 py-2.5 font-medium">Scanned</th>
              <th className="px-3 py-2.5 font-medium">Sender</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No postcard sends for this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const loc = locationLine(row.city, row.state);
                const phone = row.phone?.trim() || "";
                return (
                  <tr
                    key={row.sendId}
                    className="bg-white dark:bg-zinc-950"
                  >
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {row.businessName?.trim() || row.placeId}
                      </p>
                      {loc ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {loc}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 align-top tabular-nums">
                      {phone ? (
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                        >
                          {phone}
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-zinc-700 dark:text-zinc-300">
                      {formatWhen(row.sentAt)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {row.scannedAt ? (
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {formatWhen(row.scannedAt)}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          Not scanned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-zinc-600 dark:text-zinc-400">
                      {row.senderEmail?.trim() || (
                        <span className="font-mono text-xs">{row.userId.slice(0, 8)}…</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
