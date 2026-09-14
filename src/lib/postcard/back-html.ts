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

export const POSTCARD_QR_LABEL = "SCAN TO OPEN YOUR SITE";

/**
 * Native QR overlay is measured from the 6×4 trim edge; HTML uses the
 * 6.25×4.25 bleed artboard. Subtract 0.125in bleed from slot coordinates.
 *
 * Left column stays inside ~2.50in of trim so it does not collide with Lob's
 * return address / barcode / recipient block (right ~3.375in of a 6in card).
 *
 * Slot: 1.25in, left-aligned in the column.
 *   left bleed = 0.42in → trim 0.295in
 * Cluster top 1.55in:
 *   top bleed = 1.55 + 0.22 = 1.77in → trim 1.645in
 */
export const LOB_BACK_QR_PLACEMENT = {
  widthIn: "1.25",
  topIn: "1.645",
  leftIn: "0.295",
  pages: "back" as const,
} as const;

/** Left creative column — must not enter the USPS address zone. */
const COPY = {
  top: "0.22in",
  left: "0.28in",
  width: "2.40in",
  height: "1.28in",
} as const;

/** Pinned QR cluster — independent of headline line count. */
const QR_CLUSTER = {
  top: "1.55in",
  left: "0.28in",
  width: "2.40in",
} as const;

const QR_SIZE = "1.25in";

const RESTAURANT_HINT =
  /restaurant|sushi|cafe|café|diner|bistro|pizzeria|steakhouse|taqueria|ramen|noodle|buffet|trattoria|grill|takeout|take-out|food\s*truck/i;

const RESTAURANT_SUPPORT =
  "People find you on Google. They can't tap for a menu or a table.";
const DEFAULT_SUPPORT =
  "People find you on Google. They just have nowhere to tap.";

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Short DBA for the headline only — never the legal name. */
  shortDba?: string | null;
  /** Sender contact for "Or text …" (E.164 or national). */
  contactPhone?: string | null;
  /** Owner name when known — first name prefixes the headline. */
  ownerName?: string | null;
  category?: string | null;
  businessType?: string | null;
}): string {
  const phoneDisplay = formatUsPhoneDisplay(input.contactPhone);
  const headlineText = addressSideHeadline(
    input.ownerName,
    input.shortDba,
    input.businessName,
  );
  const headlineHtml = escapeHtml(headlineText);
  const headlineSize = headlineFontSize(headlineText);
  const support = isPostcardRestaurantCategory(
    input.category,
    input.businessType,
    input.businessName,
  )
    ? RESTAURANT_SUPPORT
    : DEFAULT_SUPPORT;

  const phoneHtml = phoneDisplay
    ? `Or text ${escapeHtml(phoneDisplay)}<br>for the free 30-day trial`
    : "Or text us<br>for the free 30-day trial";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
${LOB_PRINT_FONT_LINKS}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:6.25in;height:4.25in;font-family:${LOB_PRINT_FONT_FAMILY};color:#18181b;background:#fff;position:relative}
.copy{position:absolute;top:${COPY.top};left:${COPY.left};width:${COPY.width};height:${COPY.height};overflow:hidden}
h1{font-size:${headlineSize};font-weight:700;line-height:1.12;letter-spacing:-0.03em;margin:0 0 .08in;color:#18181b}
.support{font-size:10pt;line-height:1.3;color:#3f3f46;margin:0;max-width:100%}
.qr-cluster{position:absolute;top:${QR_CLUSTER.top};left:${QR_CLUSTER.left};width:${QR_CLUSTER.width};height:1.85in;text-align:left}
.qr-label{position:absolute;top:0;left:.14in;width:1.25in;height:.16in;line-height:.16in;font-size:6.5pt;font-weight:700;letter-spacing:.04em;color:#18181b;text-align:center;white-space:nowrap}
.qr-slot{position:absolute;top:.22in;left:.14in;width:${QR_SIZE};height:${QR_SIZE};background:#fff}
.qr-phone{position:absolute;top:1.54in;left:.14in;width:1.50in;font-size:7pt;line-height:1.3;color:#3f3f46;text-align:left}
</style>
</head>
<body>
<div class="copy">
<h1>${headlineHtml}</h1>
<p class="support">${escapeHtml(support)}</p>
</div>
<div class="qr-cluster">
<p class="qr-label">${POSTCARD_QR_LABEL}</p>
<div class="qr-slot"></div>
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

export function isPostcardRestaurantCategory(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => Boolean(value && RESTAURANT_HINT.test(value)));
}

export function addressSideHeadline(
  ownerName?: string | null,
  shortDba?: string | null,
  businessName?: string | null,
): string {
  const ownerFirst = postcardOwnerFirstName(ownerName);
  const brand = postcardBrandName(shortDba, businessName);
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

/** Short DBA for the headline — strips legal suffixes and trailing category words. */
export function postcardBrandName(
  shortDba?: string | null,
  businessName?: string | null,
): string | null {
  const preferred = shortDba?.trim() || businessName?.trim() || "";
  if (!preferred) return null;
  const brand = stripHeadlineCategoryWords(fallbackCompanyName(preferred));
  if (!brand || /^your business$/i.test(brand)) return null;
  return brand;
}

function stripHeadlineCategoryWords(value: string): string {
  const stripped = value
    .replace(
      /\s+(?:restaurants?|cafes?|cafés?|diners?|bistros?|services?|company|group|llc)$/i,
      "",
    )
    .trim();
  return stripped || value;
}

function headlineFontSize(text: string): string {
  if (text.length <= 48) return "18pt";
  if (text.length <= 64) return "16pt";
  return "14pt";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
