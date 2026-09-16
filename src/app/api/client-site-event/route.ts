import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isScriptUserAgent,
  isSearchEngineBot,
} from "@/lib/bot-detection";
import { getClientSiteByHost } from "@/lib/client-sites";
import { insertClientSiteEvent } from "@/lib/client-report/events";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1).max(80),
  eventType: z.enum(["page_view", "click_to_call"]),
  linkLocation: z.enum(["header", "hero", "contact"]).optional(),
});

function emptyOk(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("clientSiteEvent", ip, userAgent);
  if (!rateLimit.success) {
    return new NextResponse(null, {
      status: 429,
      headers: rateLimitHeaders(rateLimit),
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const host = request.headers.get("host") ?? "";
  const hostSite = getClientSiteByHost(host);
  if (!hostSite || hostSite.id !== parsed.data.siteId) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    parsed.data.eventType === "page_view" &&
    (isSearchEngineBot(userAgent) || isScriptUserAgent(userAgent))
  ) {
    return emptyOk();
  }

  try {
    await insertClientSiteEvent({
      siteId: parsed.data.siteId,
      eventType: parsed.data.eventType,
      linkLocation: parsed.data.linkLocation,
    });
  } catch (error) {
    console.error("[client-site-event] insert failed", error);
  }

  return emptyOk();
}
