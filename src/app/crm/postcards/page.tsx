import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { z } from "zod";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import {
  fetchAdminPostcardTracking,
  type PostcardTrackingMode,
  type PostcardTrackingStatus,
} from "@/lib/admin/postcard-tracking";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { getUserPostcardLifetimeSlots } from "@/lib/postcard/limits";
import {
  ensureUserProSynced,
  getLobProfilePublic,
  isPro,
} from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Postcards | Outreach Engine",
    description: "Track postcard sends and QR scans for your CRM leads.",
  };
}

const modeSchema = z.enum(["live", "test"]);
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
  status: PostcardTrackingStatus;
}): string {
  const sp = new URLSearchParams();
  sp.set("mode", opts.mode);
  if (opts.status !== "all") sp.set("status", opts.status);
  return `${CRM_BASE_PATH}/postcards?${sp.toString()}`;
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

export default async function CrmPostcardsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

  const profile = await ensureUserProSynced(user.id);
  const userIsPro = isPro(profile);
  const lob = await getLobProfilePublic(user.id);
  const slots = await getUserPostcardLifetimeSlots(user.id, { isPro: userIsPro });

  const raw = await searchParams;
  const mode = modeSchema.safeParse(firstParam(raw.mode)).success
    ? (firstParam(raw.mode) as PostcardTrackingMode)
    : lob.lob_key_mode === "live"
      ? "live"
      : "test";
  const status = statusSchema.safeParse(firstParam(raw.status)).success
    ? (firstParam(raw.status) as PostcardTrackingStatus)
    : "all";

  const { rows, error } = await fetchAdminPostcardTracking({
    mode,
    period: "all",
    status,
    userId: user.id,
  });
  const scannedCount = rows.filter((r) => r.scannedAt).length;

  return (
    <main className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[90rem]">
      <header className="space-y-2">
        <CrmNav active="postcards" isPro={userIsPro} />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Postcards
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          See when you mailed a lead and when they scanned the QR. Call anyone
          who has scanned.
          {userIsPro
            ? " Pro: unlimited postcards."
            : " Free: unlimited test proofs and one live postcard lifetime."}
        </p>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
        <p>
          {userIsPro ? (
            <span className="font-medium">Unlimited postcard sends (Pro)</span>
          ) : (
            <>
              Slots remaining:{" "}
              <span className="font-medium">Unlimited test</span>
              {" · "}
              <span className="font-medium">
                {slots.liveRemaining}/1 live
              </span>
            </>
          )}
          {!lob.has_lob_api_key || !lob.has_return_address ? (
            <>
              {" · "}
              <Link
                href="/dashboard/settings"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {!lob.has_lob_api_key && !lob.has_return_address
                  ? "Add Lob key and return address in Settings"
                  : !lob.has_lob_api_key
                    ? "Add Lob API key in Settings"
                    : "Add return address in Settings"}
              </Link>
            </>
          ) : (
            <>
              {" · "}
              Current key:{" "}
              <span className="font-medium">
                {lob.lob_key_mode === "test" ? "test" : "live"}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Mode
          </span>
          <TabLink
            href={hrefFor({ mode: "test", status })}
            active={mode === "test"}
          >
            Test
          </TabLink>
          <TabLink
            href={hrefFor({ mode: "live", status })}
            active={mode === "live"}
          >
            Production
          </TabLink>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Status
          </span>
          <TabLink
            href={hrefFor({ mode, status: "all" })}
            active={status === "all"}
          >
            All
          </TabLink>
          <TabLink
            href={hrefFor({ mode, status: "scanned" })}
            active={status === "scanned"}
          >
            Scanned
          </TabLink>
          <TabLink
            href={hrefFor({ mode, status: "unscanned" })}
            active={status === "unscanned"}
          >
            Not scanned
          </TabLink>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {rows.length.toLocaleString()} send
        {rows.length === 1 ? "" : "s"}
        {status === "all"
          ? ` · ${scannedCount.toLocaleString()} scanned`
          : null}
        {" · "}
        {mode === "test" ? "test" : "live"} events
      </p>

      {error ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-3">Business</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Sent</th>
              <th className="px-3 py-3">Scanned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No postcards in this view yet. Send one from a lead&apos;s
                  Mail tab in{" "}
                  <Link
                    href={CRM_BASE_PATH}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Leads
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const loc = locationLine(row.city, row.state);
                const phone = row.phone?.trim() || null;
                return (
                  <tr
                    key={row.sendId}
                    className="bg-white dark:bg-zinc-950"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {row.businessName ?? row.placeId}
                      </div>
                      {loc ? (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {loc}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {phone ? (
                        <a
                          href={`tel:${phone.replace(/\s+/g, "")}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {phone}
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                      {formatWhen(row.sentAt)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                      {row.scannedAt ? (
                        formatWhen(row.scannedAt)
                      ) : (
                        <span className="text-zinc-400">Not scanned</span>
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
