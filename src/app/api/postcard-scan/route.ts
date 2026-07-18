import { NextResponse } from "next/server";
import { logUsageEvent } from "@/lib/log-usage-event";
import { verifyPostcardScanToken } from "@/lib/postcard/scan-link";
import { ringReadyTenantDemoUrl } from "@/lib/ringready-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public QR landing: log postcard_scanned(_test), then redirect to the RingReady demo.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t")?.trim() ?? "";
  if (!token) {
    return new NextResponse("Missing scan token", { status: 400 });
  }

  const payload = verifyPostcardScanToken(token);
  if (!payload) {
    return new NextResponse("Invalid scan token", { status: 404 });
  }

  // Best-effort — never block the recipient from opening the demo.
  await logUsageEvent(
    payload.userId,
    payload.isTest ? "postcard_scanned_test" : "postcard_scanned",
    payload.placeId,
  );

  const demoUrl = new URL(
    ringReadyTenantDemoUrl(payload.username, payload.slug),
  );
  demoUrl.searchParams.set("utm_source", "postcard");
  demoUrl.searchParams.set("utm_medium", "qr");

  return NextResponse.redirect(demoUrl.toString(), 302);
}
