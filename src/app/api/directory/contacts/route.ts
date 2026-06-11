import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import { verifyListingAccessToken } from "@/lib/directory/listing-access-token";
import { fetchDirectoryContactsForScope } from "@/lib/directory/fetch-listing-contacts";
import {
  DEFAULT_DIRECTORY_LISTING_FILTERS,
  parseDirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import { parseListingScope } from "@/lib/directory/listing-scope";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  scope: z.string().min(3).max(200),
  token: z.string().min(10).max(500),
  page: z.coerce.number().int().min(1).optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  minReviews: z.string().optional(),
});

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: url.searchParams.get("scope"),
    token: url.searchParams.get("token"),
    page: url.searchParams.get("page") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    minReviews: url.searchParams.get("minReviews") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const scope = parseListingScope(parsed.data.scope);
  if (!scope) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const page = parsed.data.page ?? 1;
  const filters = parseDirectoryListingFilters({
    state: parsed.data.state,
    city: parsed.data.city,
    minReviews: parsed.data.minReviews,
  });

  if (
    !verifyListingAccessToken(parsed.data.token, scope, page, filters)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contacts = await fetchDirectoryContactsForScope(scope, page, filters);
    if (!contacts) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { contacts },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
