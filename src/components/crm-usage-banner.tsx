import Link from "next/link";
import {
  CRM_USAGE_ACTION_LABELS,
  type CrmUsageAction,
  type CrmUsageSummary,
} from "@/lib/crm-limits";

interface CrmUsageBannerProps {
  usage: CrmUsageSummary;
  limitReached?: boolean;
}

function formatActionBreakdown(usage: CrmUsageSummary): string {
  const parts = (["dm", "sms", "demo_click", "mail"] as CrmUsageAction[]).map(
    (action) =>
      `${usage.byAction[action].toLocaleString()} ${CRM_USAGE_ACTION_LABELS[action]}`,
  );
  return parts.join(" · ");
}

export function CrmUsageBanner({
  usage,
  limitReached = false,
}: CrmUsageBannerProps) {
  const periodEnd = new Date(usage.periodEnd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const breakdown = formatActionBreakdown(usage);

  if (limitReached || usage.remaining === 0) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        role="status"
      >
        <p>
          You&apos;ve used all{" "}
          <span className="font-medium tabular-nums">{usage.limit}</span> free
          outreach actions this month (
          <span className="tabular-nums">{breakdown}</span>
          ). Resets {periodEnd}.
        </p>
        <p className="mt-1">
          <Link
            href="/pro"
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Upgrade to Pro
          </Link>{" "}
          for unlimited outreach and full CSV export.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
      role="status"
    >
      <p>
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          {usage.used.toLocaleString()} of {usage.limit}
        </span>{" "}
        free outreach actions used this month (
        <span className="tabular-nums">{breakdown}</span>
        ).{" "}
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          {usage.remaining.toLocaleString()}
        </span>{" "}
        remaining. Resets {periodEnd}.
      </p>
      <p className="mt-1">
        <Link
          href="/pro"
          className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Upgrade to Pro
        </Link>{" "}
        for unlimited outreach and full CSV export.
      </p>
    </div>
  );
}
