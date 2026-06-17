import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import { fetchDirectoryPageExportBusinesses } from "@/lib/directory/page-export";
import { verifyListingAccessToken } from "@/lib/directory/listing-access-token";
import { parseDirectoryListingFilters } from "@/lib/directory/listing-filters";
import { parseListingScope } from "@/lib/directory/listing-scope";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { logUsageEvent } from "@/lib/log-usage-event";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  scope: z.string().min(3).max(200),
  token: z.string().min(10).max(500),
  pageSize: z.coerce.number().int().min(1).max(500),
  totalPages: z.coerce.number().int().min(1).max(10_000),
  pageUrl: z.string().min(1).max(500),
  state: z.string().optional(),
  city: z.string().optional(),
  minReviews: z.string().optional(),
});

async function logCsvDownload(
  pageUrl: string,
  userId: string | null,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("csv_downloads").insert({
    page_url: pageUrl,
    user_id: userId,
    email: null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent");
  if (isScriptUserAgent(userAgent)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("directoryPage", ip, userAgent);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: url.searchParams.get("scope"),
    token: url.searchParams.get("token"),
    pageSize: url.searchParams.get("pageSize"),
    totalPages: url.searchParams.get("totalPages"),
    pageUrl: url.searchParams.get("pageUrl"),
    state: url.searchParams.get("state") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    minReviews: url.searchParams.get("minReviews") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const scope = parseListingScope(parsed.data.scope);
  if (!scope) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const filters = parseDirectoryListingFilters({
    state: parsed.data.state,
    city: parsed.data.city,
    minReviews: parsed.data.minReviews,
  });

  if (
    !verifyListingAccessToken(parsed.data.token, scope, 1, filters)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);

  try {
    const businesses = await fetchDirectoryPageExportBusinesses(
      scope,
      filters,
      parsed.data.pageSize,
      parsed.data.totalPages,
      userIsPro,
    );

    await logCsvDownload(parsed.data.pageUrl, auth?.userId ?? null);
    if (auth?.userId) {
      void logUsageEvent(auth.userId, "csv_page_exported");
    }

    const csv = buildDirectoryBusinessesCsv(businesses);
    const filename = csvFilenameFromPagePath(parsed.data.pageUrl);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate CSV export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Legacy POST handler — redirects clients to GET export flow. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Directory CSV export now downloads immediately. Refresh the page and click Download CSV again.",
    },
    { status: 410 },
  );
}
