import Link from "next/link";
import type { CrmUsageSummary } from "@/lib/crm-limits";

interface CrmUsageBannerProps {
  usage: CrmUsageSummary;
  limitReached?: boolean;
}

export function CrmUsageBanner({
  usage,
  limitReached = false,
}: CrmUsageBannerProps) {
  const periodEnd = new Date(usage.periodEnd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (limitReached || usage.remaining === 0) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        role="status"
      >
        You&apos;ve used all {usage.limit} outreach actions this month (DMs, SMS,
        and demo links). Resets {periodEnd}.{" "}
        <Link
          href="/pro"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Upgrade to Pro
        </Link>{" "}
        for unlimited outreach and full CSV export.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
      role="status"
    >
      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {usage.remaining} of {usage.limit}
      </span>{" "}
      outreach actions left this month (DMs, SMS, demo links). Resets{" "}
      {periodEnd}.{" "}
      <Link
        href="/pro"
        className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
      >
        Upgrade to Pro
      </Link>{" "}
      for unlimited outreach and full CSV export.
    </div>
  );
}
