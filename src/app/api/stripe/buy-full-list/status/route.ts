import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import {
  createSignedListPurchaseDownloadUrl,
  fulfillListPurchaseFromSession,
  getListPurchase,
  LIST_PURCHASE_TYPE,
} from "@/lib/directory/list-purchase";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  session_id: z.string().min(10).max(200),
});

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    session_id: url.searchParams.get("session_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const sessionId = parsed.data.session_id;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.purchase_type !== LIST_PURCHASE_TYPE) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { status: "unpaid" },
        { headers: rateLimitHeaders(rateLimit) },
      );
    }

    let purchase = await getListPurchase(sessionId);
    if (!purchase || purchase.status !== "fulfilled" || !purchase.storage_path) {
      try {
        purchase = await fulfillListPurchaseFromSession(session);
      } catch (err) {
        console.error("[buy-full-list] sync fulfill failed", err);
        purchase = await getListPurchase(sessionId);
        if (!purchase || purchase.status !== "fulfilled") {
          return NextResponse.json(
            {
              status: "pending",
              error:
                err instanceof Error ? err.message : "Fulfillment in progress",
            },
            { headers: rateLimitHeaders(rateLimit) },
          );
        }
      }
    }

    if (purchase.status === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          error: purchase.error_message ?? "Fulfillment failed",
        },
        { headers: rateLimitHeaders(rateLimit) },
      );
    }

    if (!purchase.storage_path) {
      return NextResponse.json(
        { status: "pending" },
        { headers: rateLimitHeaders(rateLimit) },
      );
    }

    const downloadUrl = await createSignedListPurchaseDownloadUrl(
      purchase.storage_path,
    );

    return NextResponse.json(
      {
        status: "ready",
        downloadUrl,
        remainingRows: Math.max(
          0,
          purchase.total_rows - purchase.free_rows_given,
        ),
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check purchase status";
    console.error("[buy-full-list] status failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
