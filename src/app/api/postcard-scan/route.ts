import { NextResponse } from "next/server";
import { logUsageEvent } from "@/lib/log-usage-event";
import { resolvePostcardScanLink } from "@/lib/postcard/scan-links-db";
import {
  normalizeScanToken,
  verifyPostcardScanToken,
  type PostcardScanPayload,
} from "@/lib/postcard/scan-link";
import { ringReadyTenantDemoUrl } from "@/lib/ringready-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scanErrorPage(message: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Scan link</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1.25rem;color:#18181b;line-height:1.45}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{margin:0;color:#52525b}
</style>
</head>
<body>
<h1>${message}</h1>
<p>Hold steady and scan the postcard QR again. If it keeps failing, call or text the number printed under the code.</p>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Public QR landing: log postcard_scanned(_test), then redirect to the RingReady demo.
 * Prefers short ?id= links (Lob-safe); falls back to legacy signed ?t= tokens.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const linkId = url.searchParams.get("id")?.trim() ?? "";
  const rawToken = url.searchParams.get("t") ?? "";

  let payload: PostcardScanPayload | null = null;

  if (linkId) {
    payload = await resolvePostcardScanLink(linkId);
    if (!payload) {
      console.warn("[postcard-scan] unknown link id", {
        len: linkId.length,
        prefix: linkId.slice(0, 8),
      });
      return scanErrorPage("Couldn’t read this QR code.", 404);
    }
  } else {
    const token = normalizeScanToken(rawToken);
    if (!token) {
      return scanErrorPage("This scan link is missing its code.", 400);
    }
    payload = verifyPostcardScanToken(token);
    if (!payload) {
      console.warn("[postcard-scan] invalid token", {
        len: token.length,
        prefix: token.slice(0, 12),
      });
      return scanErrorPage("Couldn’t read this QR code.", 404);
    }
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
