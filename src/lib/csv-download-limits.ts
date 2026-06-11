import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isPro, type UserProfile } from "@/lib/subscription";
import {
  FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
  type DirectoryCsvDownloadSummary,
} from "@/lib/directory-csv-limits";

export {
  FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
  type DirectoryCsvDownloadSummary,
} from "@/lib/directory-csv-limits";

function currentMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function nextMonthStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString();
}

export function normalizeCsvDownloadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getDirectoryCsvDownloadCount(
  email: string,
): Promise<number> {
  const normalized = normalizeCsvDownloadEmail(email);
  const supabase = createSupabaseAdmin();
  const monthStart = currentMonthStartUtc();

  const { count, error } = await supabase
    .from("csv_downloads")
    .select("id", { count: "exact", head: true })
    .eq("email", normalized)
    .gte("downloaded_at", monthStart);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getDirectoryCsvDownloadSummary(
  email: string,
): Promise<DirectoryCsvDownloadSummary> {
  const used = await getDirectoryCsvDownloadCount(email);
  return {
    used,
    remaining: Math.max(0, FREE_MONTHLY_DIRECTORY_CSV_LIMIT - used),
    limit: FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
    periodEnd: nextMonthStartUtc(),
  };
}

export function canDownloadDirectoryCsv(
  profile: UserProfile | null | undefined,
  remaining: number,
): boolean {
  return isPro(profile) || remaining > 0;
}
