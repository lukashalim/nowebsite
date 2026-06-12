import { cache } from "react";
import { FREE_MONTHLY_OUTREACH_LIMIT } from "@/lib/crm-limits";
import { FREE_DIRECTORY_CSV_MAX_PAGES } from "@/lib/directory-csv-limits";
import {
  fetchAdminCrmUsageStats,
  fetchAdminCsvDownloadStats,
  fetchAdminUsageAudienceCounts,
  isUsageSegment,
} from "@/lib/admin/admin-aggregate-queries";

export type UsageSegment = "anonymous" | "free_logged_in" | "paid";

export type UsagePeriod = "month" | "all";

export interface SegmentUtilization {
  uniqueActors: number;
  totalEvents: number;
  avgEventsPerActor: number;
  actorsAtLimit: number;
  limit: number | null;
}

export interface ServiceUsageRow {
  id: string;
  label: string;
  limitLabel: string | null;
  bySegment: Record<UsageSegment, SegmentUtilization>;
  actionBreakdown?: Record<string, number>;
  note?: string;
}

export interface AdminUsageAudience {
  registeredFree: number;
  registeredPro: number;
  csvOnlyEmails: number;
}

export interface AdminUsageReport {
  period: UsagePeriod;
  periodLabel: string;
  periodStart: string | null;
  generatedAt: string;
  audience: AdminUsageAudience;
  services: ServiceUsageRow[];
  error: string | null;
}

function currentMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function emptySegmentUtilization(limit: number | null): SegmentUtilization {
  return {
    uniqueActors: 0,
    totalEvents: 0,
    avgEventsPerActor: 0,
    actorsAtLimit: 0,
    limit,
  };
}

function finalizeSegment(
  counts: Map<string, number>,
  limit: number | null,
): SegmentUtilization {
  const uniqueActors = counts.size;
  let totalEvents = 0;
  let actorsAtLimit = 0;

  for (const n of counts.values()) {
    totalEvents += n;
    if (limit !== null && n >= limit) {
      actorsAtLimit += 1;
    }
  }

  return {
    uniqueActors,
    totalEvents,
    avgEventsPerActor:
      uniqueActors > 0 ? Math.round((totalEvents / uniqueActors) * 10) / 10 : 0,
    actorsAtLimit,
    limit,
  };
}

function emptySegmentCounts(): Record<UsageSegment, Map<string, number>> {
  return {
    anonymous: new Map(),
    free_logged_in: new Map(),
    paid: new Map(),
  };
}

function aggregateCsvStatsFromRows(
  rows: Awaited<ReturnType<typeof fetchAdminCsvDownloadStats>>,
): Record<UsageSegment, SegmentUtilization> {
  const segmentCounts = emptySegmentCounts();

  for (const row of rows) {
    if (!isUsageSegment(row.segment) || !row.actor_key) continue;
    const bucket = segmentCounts[row.segment];
    bucket.set(row.actor_key, (bucket.get(row.actor_key) ?? 0) + row.download_count);
  }

  return {
    anonymous: finalizeSegment(segmentCounts.anonymous, null),
    free_logged_in: finalizeSegment(segmentCounts.free_logged_in, null),
    paid: finalizeSegment(segmentCounts.paid, null),
  };
}

function aggregateCrmStatsFromRows(
  rows: Awaited<ReturnType<typeof fetchAdminCrmUsageStats>>,
): {
  bySegment: Record<UsageSegment, SegmentUtilization>;
  actionBreakdown: Record<string, number>;
} {
  const segmentCounts = emptySegmentCounts();
  const actionBreakdown: Record<string, number> = {
    dm: 0,
    sms: 0,
    demo_click: 0,
  };

  for (const row of rows) {
    if (!isUsageSegment(row.segment) || !row.user_id) continue;

    actionBreakdown[row.action_type] =
      (actionBreakdown[row.action_type] ?? 0) + row.event_count;

    const bucket = segmentCounts[row.segment];
    bucket.set(row.user_id, (bucket.get(row.user_id) ?? 0) + row.event_count);
  }

  return {
    bySegment: {
      anonymous: finalizeSegment(segmentCounts.anonymous, null),
      free_logged_in: finalizeSegment(
        segmentCounts.free_logged_in,
        FREE_MONTHLY_OUTREACH_LIMIT,
      ),
      paid: finalizeSegment(segmentCounts.paid, null),
    },
    actionBreakdown,
  };
}

export const fetchAdminUsageReport = cache(
  async (period: UsagePeriod = "month"): Promise<AdminUsageReport> => {
    const periodStart = period === "month" ? currentMonthStartUtc() : null;
    const periodLabel =
      period === "month"
        ? `Current month (since ${new Date(periodStart!).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} UTC)`
        : "All time";

    try {
      const [audience, csvRows, crmRows] = await Promise.all([
        fetchAdminUsageAudienceCounts(),
        fetchAdminCsvDownloadStats(periodStart),
        fetchAdminCrmUsageStats(periodStart),
      ]);

      const csvStats = aggregateCsvStatsFromRows(csvRows);
      const crmStats = aggregateCrmStatsFromRows(crmRows);

      const directoryCsv: ServiceUsageRow = {
        id: "directory_csv",
        label: "Directory CSV export",
        limitLabel: `Free: first ${FREE_DIRECTORY_CSV_MAX_PAGES} pages per export · Pro: full export`,
        bySegment: csvStats,
      };

      const crmOutreach: ServiceUsageRow = {
        id: "crm_outreach",
        label: "CRM outreach (DM, SMS, demo link)",
        limitLabel: `${FREE_MONTHLY_OUTREACH_LIMIT} actions / month (free, signed in)`,
        bySegment: crmStats.bySegment,
        actionBreakdown: crmStats.actionBreakdown,
        note: "Pro outreach is unlimited and not logged. Email-only users cannot use CRM outreach.",
      };

      const crmCsvExport: ServiceUsageRow = {
        id: "crm_csv_export",
        label: "CRM leads CSV export",
        limitLabel: "Free: current page only · Pro: full export",
        bySegment: {
          anonymous: emptySegmentUtilization(null),
          free_logged_in: emptySegmentUtilization(null),
          paid: emptySegmentUtilization(null),
        },
        note: "Exports are not logged yet — counts will appear here once tracking is added.",
      };

      return {
        period,
        periodLabel,
        periodStart,
        generatedAt: new Date().toISOString(),
        audience: {
          registeredFree: audience.registered_free,
          registeredPro: audience.registered_pro,
          csvOnlyEmails: audience.csv_only_emails,
        },
        services: [directoryCsv, crmOutreach, crmCsvExport],
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load usage";
      return {
        period,
        periodLabel,
        periodStart,
        generatedAt: new Date().toISOString(),
        audience: {
          registeredFree: 0,
          registeredPro: 0,
          csvOnlyEmails: 0,
        },
        services: [
          {
            id: "directory_csv",
            label: "Directory CSV export",
            limitLabel: null,
            bySegment: {
              anonymous: emptySegmentUtilization(null),
              free_logged_in: emptySegmentUtilization(null),
              paid: emptySegmentUtilization(null),
            },
          },
          {
            id: "crm_outreach",
            label: "CRM outreach (DM, SMS, demo link)",
            limitLabel: null,
            bySegment: {
              anonymous: emptySegmentUtilization(null),
              free_logged_in: emptySegmentUtilization(25),
              paid: emptySegmentUtilization(null),
            },
          },
        ],
        error: message,
      };
    }
  },
);

export const USAGE_SEGMENT_LABELS: Record<UsageSegment, string> = {
  anonymous: "Anonymous (not signed in)",
  free_logged_in: "Free (signed in)",
  paid: "Pro (paid)",
};

export const USAGE_SEGMENT_ORDER: UsageSegment[] = [
  "anonymous",
  "free_logged_in",
  "paid",
];
