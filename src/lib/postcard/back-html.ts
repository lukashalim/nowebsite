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

/** Accent red for "competitors" in the back headline. */
const HEADLINE_ACCENT_RED = "#B91C1C";

/**
 * Lob positions native QR codes from the 6×4 trim edge, while the HTML uses
 * the 6.25×4.25 bleed artboard. Subtract the 0.125in bleed from the slot's
 * artboard coordinates so the QR overlays `.qr-slot` exactly.
 */
export const LOB_BACK_QR_PLACEMENT = {
  widthIn: "1.25",
  topIn: "1.895",
  leftIn: "0.730",
  pages: "back" as const,
} as const;

/** Left creative column — widened slightly so the h1 fits on one line. */
const COPY = {
  top: "0.22in",
  left: "0.28in",
  width: "2.65in",
  maxHeight: "1.12in",
} as const;

/** Pinned SCAN card — independent of headline line count. */
const SCAN_CARD = {
  top: "1.45in",
  left: "0.28in",
  width: "2.4in",
} as const;

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Sender contact for "Call/text us at …" (E.164 or national). */
  contactPhone?: string | null;
}): string {
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
.copy{position:absolute;top:${COPY.top};left:${COPY.left};width:${COPY.width};max-height:${COPY.maxHeight};overflow:hidden}
h1{font-size:13pt;font-weight:700;line-height:1.15;margin-bottom:.08in;white-space:nowrap;letter-spacing:-0.018em}
h1 .headline-accent{color:${HEADLINE_ACCENT_RED}}
.pitch{font-size:9pt;line-height:1.45;color:#3f3f46}
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
<h1>Calls going to your <span class="headline-accent">competitors</span>?</h1>
<p class="pitch">Your mobile site is already built.<br/>Scan to test-drive it live.<br/>First month completely free.</p>
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
