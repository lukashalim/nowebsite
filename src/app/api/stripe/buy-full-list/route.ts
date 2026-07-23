import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import {
  buildListPurchaseMetadata,
  countDirectoryListRows,
  isBuyFullListScope,
  LIST_PURCHASE_FREE_ROWS,
} from "@/lib/directory/list-purchase";
import { verifyListingAccessToken } from "@/lib/directory/listing-access-token";
import { parseDirectoryListingFilters } from "@/lib/directory/listing-filters";
import { parseListingScope } from "@/lib/directory/listing-scope";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getBuyFullListPriceId, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scope: z.string().min(3).max(200),
  token: z.string().min(10).max(500),
  pagePath: z.string().min(1).max(500),
  state: z.string().optional(),
  city: z.string().optional(),
  minReviews: z.string().optional(),
});

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  if (isScriptUserAgent(userAgent)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("buyFullList", ip, userAgent);
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
  if (!scope || !isBuyFullListScope(scope)) {
    return NextResponse.json(
      { error: "Full-list purchase is only available for category and city pages" },
      { status: 400 },
    );
  }

  const filters = parseDirectoryListingFilters({
    state: parsed.data.state,
    city: parsed.data.city,
    minReviews: parsed.data.minReviews,
  });

  if (!verifyListingAccessToken(parsed.data.token, scope, 1, filters)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const totalRows = await countDirectoryListRows(scope, filters);
    if (totalRows <= LIST_PURCHASE_FREE_ROWS) {
      return NextResponse.json(
        { error: "This list fits in the free download — nothing left to purchase" },
        { status: 400 },
      );
    }

    const pagePath = parsed.data.pagePath.startsWith("/")
      ? parsed.data.pagePath
      : `/${parsed.data.pagePath}`;

    const metadata = buildListPurchaseMetadata({
      scope,
      filters,
      totalRows,
      pagePath,
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      line_items: [{ price: getBuyFullListPriceId(), quantity: 1 }],
      metadata: { ...metadata },
      // Checkout collects a required email (fallback delivery recipient).
      customer_creation: "if_required",
      billing_address_collection: "auto",
    });

    if (!session.client_secret) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        sessionId: session.id,
        remainingRows: totalRows - LIST_PURCHASE_FREE_ROWS,
        totalRows,
        freeRowsGiven: LIST_PURCHASE_FREE_ROWS,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start checkout";
    console.error("[buy-full-list] create session failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
