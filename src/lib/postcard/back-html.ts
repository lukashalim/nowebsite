/**
 * Lob 4×6 postcard back HTML (landscape bleed 6.25″×4.25″).
 * Creative in the left safe column; Lob address/postage on the right.
 * SCAN card is absolutely positioned so the QR slot never moves when the
 * headline wraps — must match {@link LOB_BACK_QR_PLACEMENT} for Lob's
 * native qr_code overlay.
 * Lob inline HTML must stay under 10,000 characters.
 */

import {
  LOB_PRINT_FONT_FAMILY,
  LOB_PRINT_FONT_LINKS,
} from "@/lib/postcard/lob-fonts";

/** Forest green + gold from the SCAN card mockup. */
const SCAN_GREEN = "#1a4731";
const SCAN_GOLD = "#c5a059";

/**
 * Lob positions native QR codes from the 6×4 trim edge, while the HTML uses
 * the 6.25×4.25 bleed artboard. Subtract the 0.125in bleed from the slot's
 * artboard coordinates so the QR overlays `.qr-slot` exactly.
 */
export const LOB_BACK_QR_PLACEMENT = {
  widthIn: "1.25",
  topIn: "1.545",
  leftIn: "0.730",
  pages: "back" as const,
} as const;

/** Pinned SCAN card — independent of headline line count. */
const SCAN_CARD = {
  top: "1.10in",
  left: "0.28in",
  width: "2.4in",
} as const;

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Sender contact for "Call/text us at …" (E.164 or national). */
  contactPhone?: string | null;
}): string {
  const name = escapeHtml(input.businessName || "your business");

  const phoneDisplay = formatUsPhoneDisplay(input.contactPhone);
  const footerHtml = phoneDisplay
    ? `<p class="scan-footer">Call/text us at ${escapeHtml(phoneDisplay)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
${LOB_PRINT_FONT_LINKS}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:6.25in;height:4.25in;font-family:${LOB_PRINT_FONT_FAMILY};color:#18181b;background:#fff;position:relative}
.copy{position:absolute;top:.22in;left:.28in;width:2.4in;max-height:.82in;overflow:hidden}
h1{font-size:13pt;font-weight:700;line-height:1.15;margin-bottom:.06in}
.pitch{font-size:9pt;line-height:1.25;color:#3f3f46}
.scan-card{position:absolute;top:${SCAN_CARD.top};left:${SCAN_CARD.left};width:${SCAN_CARD.width};border:2.5px solid ${SCAN_GREEN};border-radius:.1in;overflow:hidden;background:#fff;text-align:center}
.scan-head{background:${SCAN_GREEN};padding:.08in .08in .07in;line-height:1.15}
.scan-line1{font-size:10pt;font-weight:700;letter-spacing:.04em;color:#fff}
.scan-line2{font-size:10pt;font-weight:700;letter-spacing:.04em;color:${SCAN_GOLD};margin-top:.02in}
.scan-body{padding:.08in .1in .04in}
.qr-slot{width:1.25in;height:1.25in;margin:0 auto;background:#fff}
.scan-footer{font-size:7.5pt;line-height:1.25;color:#666;padding:0 .08in .08in}
</style>
</head>
<body>
<div class="copy">
<h1>${name} now has a website.</h1>
<p class="pitch">Built from your Google listing. Live in 24 hours if you want it.</p>
</div>
<div class="scan-card">
<div class="scan-head">
<p class="scan-line1">SCAN TO SEE</p>
<p class="scan-line2">YOUR SITE</p>
</div>
<div class="scan-body"><div class="qr-slot"></div></div>
${footerHtml}
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
