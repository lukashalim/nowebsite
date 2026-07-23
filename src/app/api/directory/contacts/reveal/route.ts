import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import { toContactRow } from "@/lib/directory/contact-fields";
import { fetchDirectoryBusinessesForScope } from "@/lib/directory/fetch-listing-contacts";
import { verifyListingAccessToken } from "@/lib/directory/listing-access-token";
import {
  DEFAULT_DIRECTORY_LISTING_FILTERS,
  parseDirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import { parseListingScope } from "@/lib/directory/listing-scope";
import { logUsageEvent } from "@/lib/log-usage-event";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getAuthenticatedUserProfile, isPro } from "@/lib/subscription";
import { canRevealDirectoryPageContacts } from "@/lib/directory/free-browse-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scope: z.string().min(3).max(200),
  token: z.string().min(10).max(500),
  page: z.number().int().min(1).optional(),
  filters: z
    .object({
      stateSlug: z.string().nullable().optional(),
      citySlug: z.string().nullable().optional(),
      minReviews: z.number().int().min(0).optional(),
    })
    .optional(),
  row: z.number().int().min(0).max(500),
});

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  if (isScriptUserAgent(userAgent)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("directoryContacts", ip, userAgent);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const scope = parseListingScope(parsed.data.scope);
  if (!scope) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const page = parsed.data.page ?? 1;
  const auth = await getAuthenticatedUserProfile();
  const userIsPro = isPro(auth?.profile);
  if (!canRevealDirectoryPageContacts(scope.kind, page, userIsPro)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filters = parsed.data.filters
    ? parseDirectoryListingFilters({
        state: parsed.data.filters.stateSlug ?? undefined,
        city: parsed.data.filters.citySlug ?? undefined,
        minReviews:
          parsed.data.filters.minReviews != null
            ? String(parsed.data.filters.minReviews)
            : undefined,
      })
    : DEFAULT_DIRECTORY_LISTING_FILTERS;

  if (!verifyListingAccessToken(parsed.data.token, scope, page, filters)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const businesses = await fetchDirectoryBusinessesForScope(scope, page, filters);
    if (!businesses) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rowIndex = parsed.data.row;
    const business = businesses[rowIndex];
    if (!business) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (auth) {
      void logUsageEvent(
        auth.userId,
        "lead_contact_revealed",
        business.demo_slug?.trim() || undefined,
      );
    }

    return NextResponse.json(
      { contact: toContactRow(business, rowIndex) },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load contact details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
