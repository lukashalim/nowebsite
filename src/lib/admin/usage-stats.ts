import { cache } from "react";
import { FREE_MONTHLY_OUTREACH_LIMIT } from "@/lib/crm-limits";
import { FREE_MONTHLY_DIRECTORY_CSV_LIMIT } from "@/lib/directory-csv-limits";
import { normalizeCsvDownloadEmail } from "@/lib/csv-download-limits";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BATCH = 1000;

export type UsageSegment = "email_signup" | "free_logged_in" | "paid";

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

interface ProfileRow {
  id: string;
  email: string | null;
  is_pro: boolean;
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

async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const supabase = createSupabaseAdmin();
  const rows: ProfileRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, is_pro")
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ProfileRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return rows;
}

function classifyEmailSegment(
  email: string,
  profileByEmail: Map<string, ProfileRow>,
): UsageSegment {
  const profile = profileByEmail.get(normalizeCsvDownloadEmail(email));
  if (!profile) return "email_signup";
  if (profile.is_pro) return "paid";
  return "free_logged_in";
}

function classifyUserSegment(
  userId: string,
  profileById: Map<string, ProfileRow>,
): UsageSegment {
  const profile = profileById.get(userId);
  if (!profile) return "free_logged_in";
  if (profile.is_pro) return "paid";
  return "free_logged_in";
}

async function aggregateCsvDownloads(
  periodStart: string | null,
  profileByEmail: Map<string, ProfileRow>,
): Promise<{
  bySegment: Record<UsageSegment, SegmentUtilization>;
}> {
  const supabase = createSupabaseAdmin();
  const segmentCounts: Record<UsageSegment, Map<string, number>> = {
    email_signup: new Map(),
    free_logged_in: new Map(),
    paid: new Map(),
  };
  let from = 0;

  while (true) {
    let q = supabase
      .from("csv_downloads")
      .select("email, downloaded_at")
      .order("id", { ascending: true });

    if (periodStart) {
      q = q.gte("downloaded_at", periodStart);
    }

    const { data, error } = await q.range(from, from + BATCH - 1);
    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const row of batch) {
      const email = normalizeCsvDownloadEmail(String(row.email ?? ""));
      if (!email) continue;

      const segment = classifyEmailSegment(email, profileByEmail);
      const bucket = segmentCounts[segment];
      bucket.set(email, (bucket.get(email) ?? 0) + 1);
    }

    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return {
    bySegment: {
      email_signup: finalizeSegment(
        segmentCounts.email_signup,
        FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
      ),
      free_logged_in: finalizeSegment(
        segmentCounts.free_logged_in,
        FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
      ),
      paid: finalizeSegment(segmentCounts.paid, null),
    },
  };
}

async function countCsvOnlyEmails(
  profileByEmail: Map<string, ProfileRow>,
): Promise<number> {
  const supabase = createSupabaseAdmin();
  const allCsvEmails = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("csv_downloads")
      .select("email")
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const row of batch) {
      const email = normalizeCsvDownloadEmail(String(row.email ?? ""));
      if (email) allCsvEmails.add(email);
    }

    if (batch.length < BATCH) break;
    from += BATCH;
  }

  let csvOnlyEmails = 0;
  for (const email of allCsvEmails) {
    if (!profileByEmail.has(email)) {
      csvOnlyEmails += 1;
    }
  }

  return csvOnlyEmails;
}

async function aggregateCrmUsage(
  periodStart: string | null,
  profileById: Map<string, ProfileRow>,
): Promise<{
  bySegment: Record<UsageSegment, SegmentUtilization>;
  actionBreakdown: Record<string, number>;
}> {
  const supabase = createSupabaseAdmin();
  const segmentCounts: Record<UsageSegment, Map<string, number>> = {
    email_signup: new Map(),
    free_logged_in: new Map(),
    paid: new Map(),
  };
  const actionBreakdown: Record<string, number> = {
    dm: 0,
    sms: 0,
    demo_click: 0,
  };
  let from = 0;

  while (true) {
    let q = supabase
      .from("crm_usage_events")
      .select("user_id, action_type, created_at")
      .order("id", { ascending: true });

    if (periodStart) {
      q = q.gte("created_at", periodStart);
    }

    const { data, error } = await q.range(from, from + BATCH - 1);
    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const row of batch) {
      const userId = String(row.user_id ?? "");
      const action = String(row.action_type ?? "unknown");
      if (!userId) continue;

      actionBreakdown[action] = (actionBreakdown[action] ?? 0) + 1;

      const segment = classifyUserSegment(userId, profileById);
      const bucket = segmentCounts[segment];
      bucket.set(userId, (bucket.get(userId) ?? 0) + 1);
    }

    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return {
    bySegment: {
      email_signup: finalizeSegment(segmentCounts.email_signup, null),
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
      const profiles = await fetchAllProfiles();
      const profileByEmail = new Map<string, ProfileRow>();
      const profileById = new Map<string, ProfileRow>();
      let registeredFree = 0;
      let registeredPro = 0;

      for (const profile of profiles) {
        profileById.set(profile.id, profile);
        if (profile.is_pro) {
          registeredPro += 1;
        } else {
          registeredFree += 1;
        }
        if (profile.email?.trim()) {
          profileByEmail.set(normalizeCsvDownloadEmail(profile.email), profile);
        }
      }

      const [csvStats, crmStats, csvOnlyEmails] = await Promise.all([
        aggregateCsvDownloads(periodStart, profileByEmail),
        aggregateCrmUsage(periodStart, profileById),
        countCsvOnlyEmails(profileByEmail),
      ]);

      const directoryCsv: ServiceUsageRow = {
        id: "directory_csv",
        label: "Directory CSV export",
        limitLabel: `${FREE_MONTHLY_DIRECTORY_CSV_LIMIT} page exports / month (free)`,
        bySegment: csvStats.bySegment,
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
          email_signup: emptySegmentUtilization(null),
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
          registeredFree,
          registeredPro,
          csvOnlyEmails,
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
              email_signup: emptySegmentUtilization(5),
              free_logged_in: emptySegmentUtilization(5),
              paid: emptySegmentUtilization(null),
            },
          },
          {
            id: "crm_outreach",
            label: "CRM outreach (DM, SMS, demo link)",
            limitLabel: null,
            bySegment: {
              email_signup: emptySegmentUtilization(null),
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
  email_signup: "Email signup (no account)",
  free_logged_in: "Free (signed in)",
  paid: "Pro (paid)",
};

export const USAGE_SEGMENT_ORDER: UsageSegment[] = [
  "email_signup",
  "free_logged_in",
  "paid",
];
