import { NextResponse } from "next/server";
import { z } from "zod";
import { isScriptUserAgent } from "@/lib/bot-detection";
import { getClientSiteByHost } from "@/lib/client-sites";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { sendTextbeeSms, toE164Us } from "@/lib/textbee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  siteId: z.string().min(1).max(80),
  serviceTitle: z.string().min(1).max(80),
  address: z.string().trim().min(8).max(200),
  phone: z.string().min(7).max(32),
  company: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  if (isScriptUserAgent(userAgent)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(
    "clientSiteServiceRequest",
    ip,
    userAgent,
  );
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
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
    return NextResponse.json(
      { error: "Enter a street address and a valid phone number." },
      { status: 400 },
    );
  }

  if (parsed.data.company?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const host = request.headers.get("host") ?? "";
  const site = getClientSiteByHost(host);
  if (!site || site.id !== parsed.data.siteId) {
    return new NextResponse(null, { status: 404 });
  }

  const service = site.services.find(
    (item) => item.title === parsed.data.serviceTitle,
  );
  if (!service) {
    return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  }

  const customerPhone = toE164Us(parsed.data.phone);
  if (!customerPhone) {
    return NextResponse.json(
      { error: "Enter a valid US phone number." },
      { status: 400 },
    );
  }

  const notifyPhone = site.notifyPhone?.trim();
  if (!notifyPhone) {
    return NextResponse.json(
      { error: "Requests are not available right now." },
      { status: 503 },
    );
  }

  const address = parsed.data.address.replace(/\s+/g, " ").trim();
  const message = [
    `${site.name} request: ${service.title}`,
    `Address: ${address}`,
    `Phone: ${customerPhone}`,
  ].join("\n");

  const sent = await sendTextbeeSms({
    recipients: [notifyPhone],
    message,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error },
      { status: sent.status },
    );
  }

  return NextResponse.json({ ok: true });
}
