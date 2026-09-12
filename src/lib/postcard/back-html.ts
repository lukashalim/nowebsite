/**
 * Lob 4×6 postcard back HTML (landscape bleed 6.25″×4.25″).
 * Address side is the visual "front": sparse personalized copy + giant QR
 * in the left safe column; Lob address/postage on the right.
 *
 * QR slot is absolutely positioned so it never moves when the headline wraps
 * — must match {@link LOB_BACK_QR_PLACEMENT} for Lob's native qr_code overlay.
 *
 * Lob inline HTML must stay under 10,000 characters.
 */

import "server-only";

import { postcardOwnerFirstName } from "@/lib/postcard/call-headline";
import { fallbackCompanyName } from "@/lib/postcard/company-name";
import {
  LOB_PRINT_FONT_FAMILY,
  LOB_PRINT_FONT_LINKS,
} from "@/lib/postcard/lob-fonts";

/**
 * Native QR overlay is measured from the 6×4 trim edge; HTML uses the
 * 6.25×4.25 bleed artboard. Subtract 0.125in bleed from slot coordinates.
 *
 * Slot: 1.25in, centered in the 2.92in left column at left 0.28in.
 *   left bleed = 0.28 + (2.92 − 1.25) / 2 = 1.115in → trim 0.990in
 * Label is a fixed 0.14in + 0.08in gap above the slot.
 *   top bleed = 2.05 + 0.14 + 0.08 = 2.27in → trim 2.145in
 */
export const LOB_BACK_QR_PLACEMENT = {
  widthIn: "1.25",
  topIn: "2.145",
  leftIn: "0.990",
  pages: "back" as const,
} as const;

/** Left creative column — headline + supporting line only. */
const COPY = {
  top: "0.22in",
  left: "0.28in",
  width: "2.92in",
  maxHeight: "1.72in",
} as const;

/** Pinned QR cluster — independent of headline line count. */
const QR_CLUSTER = {
  top: "2.05in",
  left: "0.28in",
  width: "2.92in",
} as const;

const QR_SIZE = "1.25in";

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Sender contact for "Or text …" (E.164 or national). */
  contactPhone?: string | null;
  /** Owner name when known — first name prefixes the headline. */
  ownerName?: string | null;
}): string {
  const phoneDisplay = formatUsPhoneDisplay(input.contactPhone);
  const headlineText = addressSideHeadline(input.ownerName, input.businessName);
  const headlineHtml = escapeHtml(headlineText);
  const headlineSize = headlineFontSize(headlineText);

  const phoneHtml = phoneDisplay
    ? `Or text ${escapeHtml(phoneDisplay)} for the free 30-day trial`
    : "Or text us for the free 30-day trial";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
${LOB_PRINT_FONT_LINKS}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:6.25in;height:4.25in;font-family:${LOB_PRINT_FONT_FAMILY};color:#18181b;background:#fff;position:relative}
.copy{position:absolute;top:${COPY.top};left:${COPY.left};width:${COPY.width};max-height:${COPY.maxHeight};overflow:hidden}
h1{font-size:${headlineSize};font-weight:700;line-height:1.12;letter-spacing:-0.03em;margin:0 0 .1in;color:#18181b}
.support{font-size:10pt;line-height:1.3;color:#3f3f46;margin:0;max-width:100%}
.qr-cluster{position:absolute;top:${QR_CLUSTER.top};left:${QR_CLUSTER.left};width:${QR_CLUSTER.width};height:1.95in;text-align:center}
.qr-label{position:absolute;top:0;left:0;width:100%;height:.14in;line-height:.14in;font-size:8pt;font-weight:700;letter-spacing:.14em;color:#18181b}
.qr-slot{position:absolute;top:.22in;left:.835in;width:${QR_SIZE};height:${QR_SIZE};background:#fff}
.qr-proof{position:absolute;top:1.55in;left:0;width:100%;font-size:7pt;line-height:1.25;color:#71717a}
.qr-phone{position:absolute;top:1.72in;left:0;width:100%;font-size:7.5pt;line-height:1.3;color:#3f3f46}
</style>
</head>
<body>
<div class="copy">
<h1>${headlineHtml}</h1>
<p class="support">People find you on Google. They just have nowhere to tap.</p>
</div>
<div class="qr-cluster">
<p class="qr-label">SCAN TO OPEN YOUR SITE</p>
<div class="qr-slot"></div>
<p class="qr-proof">Live preview &middot; no login &middot; no credit card</p>
<p class="qr-phone">${phoneHtml}</p>
</div>
</body>
</html>`;

  if (html.length > 10000) {
    throw new Error(
      `Postcard back HTML is ${html.length} chars (Lob limit 10000).`,
    );
  }

  return html;
}

/** Format a US number as (XXX) XXX-XXXX when possible. */
export function formatUsPhoneDisplay(
  phone: string | null | undefined,
): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  let national = digits;
  if (national.length === 11 && national.startsWith("1")) {
    national = national.slice(1);
  }
  if (national.length !== 10) {
    const trimmed = phone.trim();
    return trimmed || null;
  }
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function addressSideHeadline(
  ownerName?: string | null,
  businessName?: string | null,
): string {
  const ownerFirst = postcardOwnerFirstName(ownerName);
  const brand = postcardBrandName(businessName);
  if (ownerFirst && brand) {
    return `${ownerFirst} — your ${brand} site is already built.`;
  }
  if (ownerFirst) {
    return `${ownerFirst} — your site is already built.`;
  }
  if (brand) {
    return `Your ${brand} site is already built.`;
  }
  return "Your site is already built.";
}

function postcardBrandName(businessName?: string | null): string | null {
  const trimmed = businessName?.trim() ?? "";
  if (!trimmed) return null;
  const brand = fallbackCompanyName(trimmed);
  if (!brand || /^your business$/i.test(brand)) return null;
  return brand;
}

function headlineFontSize(text: string): string {
  if (text.length <= 52) return "20pt";
  if (text.length <= 70) return "17pt";
  return "15pt";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
