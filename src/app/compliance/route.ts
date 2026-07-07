import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LEGAL_COMPANY_NAME,
  RING_READY_COMPLIANCE_CHECKBOX_TEXT,
  RING_READY_COMPLIANCE_CONSENT_VERSION,
  RING_READY_COMPLIANCE_DISCLOSURE,
  RING_READY_COMPLIANCE_SOURCE,
} from "@/lib/legal-placeholders";
import { processRingReadySmsOptIn } from "@/lib/ringready-sms-opt-in-core";
import { getClientIp } from "@/lib/rate-limit";
import { isRingReadyHost } from "@/lib/ringready-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlWithBoldStopHelp(value: string): string {
  return escapeHtml(value)
    .replace(/\bSTOP\b/g, "<strong>STOP</strong>")
    .replace(/\bHELP\b/g, "<strong>HELP</strong>");
}

function renderComplianceCheckboxLabel(): string {
  return (
    `${escapeHtmlWithBoldStopHelp(RING_READY_COMPLIANCE_CHECKBOX_TEXT)} ` +
    `<a href="/privacy">Privacy Policy</a> ` +
    `<a href="/terms">Terms of Service</a>`
  );
}

function renderComplianceOptOutInstructions(): string {
  return `<p><strong>Opt Out:</strong> You may opt out at any time by replying <strong>STOP</strong> to any message you receive. After you send <strong>STOP</strong>, you will receive a confirmation and no further demo-status texts unless you opt in again.</p>
  <p><strong>Help:</strong> Reply <strong>HELP</strong> for assistance.</p>`;
}

function renderCompliancePage(options: {
  subscribed?: boolean;
  error?: "invalid" | "rate_limit";
}): string {
  const statusMessage = options.subscribed
    ? "<p>Thank you. You are signed up for RingReadySite demo alerts.</p>"
    : options.error === "rate_limit"
      ? "<p>Too many attempts. Please try again later.</p>"
      : options.error === "invalid"
        ? "<p>Please enter a valid mobile number and agree to the terms to continue.</p>"
        : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMS Compliance - ${escapeHtml(LEGAL_COMPANY_NAME)}</title>
</head>
<body>
  <h1>${escapeHtml(LEGAL_COMPANY_NAME)}</h1>
  <p>${escapeHtmlWithBoldStopHelp(RING_READY_COMPLIANCE_DISCLOSURE)}</p>
  ${renderComplianceOptOutInstructions()}
  <p>
    <a href="/privacy">Privacy Policy</a> ·
    <a href="/terms">Terms of Service</a> ·
    <a href="/sms-disclosure">SMS Disclosure</a>
  </p>
  ${statusMessage}
  <form method="post" action="/compliance">
    <p>
      <label for="phone">Mobile phone number</label><br>
      <input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="(555) 555-5555">
    </p>
    <p>
      <label>
        <input name="consent" type="checkbox" value="yes" required>
        ${renderComplianceCheckboxLabel()}
      </label>
    </p>
    <p>
      <button type="submit">Get SMS Updates</button>
    </p>
  </form>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const subscribed = request.nextUrl.searchParams.get("subscribed") === "1";
  const errorParam = request.nextUrl.searchParams.get("error");
  const error =
    errorParam === "rate_limit"
      ? "rate_limit"
      : errorParam === "invalid"
        ? "invalid"
        : undefined;

  return new NextResponse(renderCompliancePage({ subscribed, error }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!isRingReadyHost(host)) {
    return NextResponse.redirect(
      new URL("/compliance?error=invalid", request.url),
      303,
    );
  }

  const formData = await request.formData();
  const phone = formData.get("phone");
  const consent = formData.get("consent");

  const result = await processRingReadySmsOptIn({
    phoneRaw: typeof phone === "string" ? phone : "",
    consent: typeof consent === "string" ? consent : null,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    source: RING_READY_COMPLIANCE_SOURCE,
    consentVersion: RING_READY_COMPLIANCE_CONSENT_VERSION,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(
        `/compliance?error=${result.reason === "rate_limit" ? "rate_limit" : "invalid"}`,
        request.url,
      ),
      303,
    );
  }

  return NextResponse.redirect(
    new URL("/compliance?subscribed=1", request.url),
    303,
  );
}
