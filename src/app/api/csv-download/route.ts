import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
  getDirectoryCsvDownloadCount,
  getDirectoryCsvDownloadSummary,
  normalizeCsvDownloadEmail,
} from "@/lib/csv-download-limits";
import { addContactToList } from "@/lib/sendfox";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvDownloadSchema = z.object({
  email: z.email(),
  pageUrl: z.string().min(1).max(500),
  mode: z.literal("page"),
});

export async function GET(request: Request) {
  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);

  if (userIsPro) {
    return NextResponse.json({ isPro: true });
  }

  const { searchParams } = new URL(request.url);
  const rawEmail = searchParams.get("email");

  if (rawEmail?.trim()) {
    const normalizedEmail = normalizeCsvDownloadEmail(rawEmail);
    try {
      const summary = await getDirectoryCsvDownloadSummary(normalizedEmail);
      return NextResponse.json({
        isPro: false,
        used: summary.used,
        remaining: summary.remaining,
        limit: summary.limit,
        periodEnd: summary.periodEnd,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load download status";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({
    isPro: false,
    used: 0,
    remaining: FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
    limit: FREE_MONTHLY_DIRECTORY_CSV_LIMIT,
  });
}

async function logCsvDownload(email: string, pageUrl: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("csv_downloads").insert({
    email: normalizeCsvDownloadEmail(email),
    page_url: pageUrl,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = csvDownloadSchema.safeParse(body);
  if (!parsed.success) {
    const legacyFull =
      typeof body === "object" &&
      body !== null &&
      (body as { mode?: string }).mode === "full";
    if (legacyFull) {
      return NextResponse.json(
        { error: "Full directory CSV export is not available" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, pageUrl } = parsed.data;
  const normalizedEmail = normalizeCsvDownloadEmail(email);

  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);

  if (!userIsPro) {
    let used: number;
    try {
      used = await getDirectoryCsvDownloadCount(normalizedEmail);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not verify download limit";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (used >= FREE_MONTHLY_DIRECTORY_CSV_LIMIT) {
      const summary = await getDirectoryCsvDownloadSummary(normalizedEmail);
      return NextResponse.json(
        {
          error: "Monthly CSV download limit reached.",
          code: "csv_limit_reached",
          used: summary.used,
          limit: summary.limit,
          periodEnd: summary.periodEnd,
        },
        { status: 403 },
      );
    }
  }

  try {
    await addContactToList(email);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to subscribe email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    await logCsvDownload(normalizedEmail, pageUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to log CSV download";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (userIsPro) {
    return NextResponse.json({ ok: true, remaining: null, limit: null });
  }

  const summary = await getDirectoryCsvDownloadSummary(normalizedEmail);
  return NextResponse.json({
    ok: true,
    remaining: summary.remaining,
    limit: summary.limit,
  });
}
