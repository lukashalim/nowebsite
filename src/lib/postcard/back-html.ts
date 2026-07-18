/**
 * Lob 4×6 postcard back HTML (portrait bleed 4.25″×6.25″).
 * Keep creative in the upper-LEFT safe area; Lob reserves the right side for
 * postage/return/recipient and the lower zone for the address block.
 * Lob inline HTML must stay under 10,000 characters.
 *
 * QR must be a public HTTPS <img> URL — Lob WebKit drops data-URI QR images.
 */

import {
  LOB_PRINT_FONT_FAMILY,
  LOB_PRINT_FONT_LINKS,
} from "@/lib/postcard/lob-fonts";

/** Forest green + gold from the SCAN card mockup. */
const SCAN_GREEN = "#1a4731";
const SCAN_GOLD = "#c5a059";

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Public HTTPS URL to a PNG QR image Lob can fetch. */
  qrImageUrl: string;
  /** Sender contact for "Or call/text …" (E.164 or national). */
  contactPhone?: string | null;
}): string {
  const name = escapeHtml(input.businessName || "your business");
  const qrSrc = input.qrImageUrl.trim();
  if (!qrSrc || !/^https:\/\//i.test(qrSrc)) {
    throw new Error("Postcard QR must be a public https:// image URL for Lob.");
  }

  const phoneDisplay = formatUsPhoneDisplay(input.contactPhone);
  const footerHtml = phoneDisplay
    ? `<p class="scan-footer">Or call/text ${escapeHtml(phoneDisplay)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
${LOB_PRINT_FONT_LINKS}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:4.25in;height:6.25in;font-family:${LOB_PRINT_FONT_FAMILY};color:#18181b;background:#fff;position:relative}
.safe{position:absolute;top:.28in;left:.28in;width:2.15in}
h1{font-size:13pt;font-weight:700;line-height:1.2;margin-bottom:.08in}
.pitch{font-size:9pt;line-height:1.3;color:#3f3f46;margin-bottom:.12in}
.scan-card{border:2.5px solid ${SCAN_GREEN};border-radius:.1in;overflow:hidden;background:#fff;text-align:center}
.scan-head{background:${SCAN_GREEN};padding:.1in .08in .09in;line-height:1.15}
.scan-line1{font-size:11pt;font-weight:700;letter-spacing:.04em;color:#fff}
.scan-line2{font-size:11pt;font-weight:700;letter-spacing:.04em;color:${SCAN_GOLD};margin-top:.02in}
.scan-body{padding:.12in .1in .08in}
.qr{width:1.2in;height:1.2in;margin:0 auto}
.qr img{width:100%;height:100%;display:block}
.scan-footer{font-size:7.5pt;line-height:1.25;color:#666;padding:0 .08in .1in}
</style>
</head>
<body>
<div class="safe">
<h1>${name} now has a website.</h1>
<p class="pitch">Built from your Google listing. Live in 24 hours if you want it.</p>
<div class="scan-card">
<div class="scan-head">
<p class="scan-line1">SCAN TO SEE</p>
<p class="scan-line2">YOUR SITE</p>
</div>
<div class="scan-body"><div class="qr"><img src="${escapeHtml(qrSrc)}" width="200" height="200" alt="QR"/></div></div>
${footerHtml}
</div>
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
