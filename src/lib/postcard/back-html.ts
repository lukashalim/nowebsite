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

export function buildPostcardBackHtml(input: {
  businessName: string;
  /** Public HTTPS URL to a PNG QR image Lob can fetch. */
  qrImageUrl: string;
}): string {
  const name = escapeHtml(input.businessName || "your business");
  const qrSrc = input.qrImageUrl.trim();
  if (!qrSrc || !/^https:\/\//i.test(qrSrc)) {
    throw new Error("Postcard QR must be a public https:// image URL for Lob.");
  }

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
.pitch{font-size:9pt;line-height:1.3;color:#3f3f46;margin-bottom:.14in}
.scan-box{border:2px solid #047857;border-radius:.08in;padding:.1in .1in .12in;background:#ecfdf5;text-align:center}
.scan-label{font-size:8.5pt;font-weight:700;letter-spacing:.04em;color:#047857;line-height:1.2;margin-bottom:.08in}
.qr{width:1.15in;height:1.15in;margin:0 auto;background:#fff;padding:.04in;border-radius:.04in}
.qr img{width:100%;height:100%;display:block}
</style>
</head>
<body>
<div class="safe">
<h1>${name} now has a website.</h1>
<p class="pitch">Built from your Google listing. Live in 24 hours if you want it.</p>
<div class="scan-box">
<p class="scan-label">SCAN TO SEE YOUR SITE</p>
<div class="qr"><img src="${escapeHtml(qrSrc)}" width="200" height="200" alt="QR"/></div>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
