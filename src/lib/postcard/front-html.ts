/**
 * Lob 4×6 postcard front HTML (landscape bleed 6.25″×4.25″).
 * Phone-frame mockup of the live site. Native QR shares {@link POSTCARD_QR_SLOT}
 * with the address side so Lob can overlay both faces.
 */

import "server-only";

import { parseReviewHighlights } from "@/lib/demo-review-types";
import {
  formatUsPhoneDisplay,
  POSTCARD_QR_LABEL,
  POSTCARD_QR_SLOT,
} from "@/lib/postcard/back-html";
import { pickPostcardReviewExcerpt } from "@/lib/postcard/review-excerpt";
import {
  LOB_PRINT_FONT_FAMILY,
  LOB_PRINT_FONT_LINKS,
} from "@/lib/postcard/lob-fonts";

/** White handset icon for Lob print CTA (inline SVG — no external asset). */
const CTA_PHONE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.02l-2.2 2.19z"/></svg>`;

const PHONE_WIDTH = "2.7in";
/** Right of the shared native QR slot (0.42 + 1.25 + gap). */
const PHONE_LEFT = "1.90in";

export function buildPostcardFrontHtml(input: {
  businessName: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  reviewHighlights?: unknown;
  phone?: string | null;
}): string {
  const name = escapeHtml(input.businessName.trim() || "Your business");
  const category = escapeHtml(
    (input.category?.trim() || "Local business").toUpperCase(),
  );
  const loc = [input.city?.trim(), input.state?.trim()].filter(Boolean).join(", ");
  const locHtml = loc ? escapeHtml(loc) : "";
  const city = input.city?.trim() ?? "";
  const subline = city
    ? `${city} · already live · yours to claim`
    : "Already live · yours to claim";

  const rating =
    input.rating != null && Number.isFinite(Number(input.rating))
      ? Number(input.rating)
      : null;
  const reviewCount =
    input.reviewCount != null && Number.isFinite(Number(input.reviewCount))
      ? Math.round(Number(input.reviewCount))
      : null;

  const highlights = parseReviewHighlights(input.reviewHighlights) ?? [];
  const pickedReview = pickPostcardReviewExcerpt(highlights);
  const quoteHtml = pickedReview?.excerpt
    ? escapeHtml(pickedReview.excerpt)
    : "";
  const reviewerHtml = pickedReview?.reviewer_name
    ? escapeHtml(formatReviewerDisplayName(pickedReview.reviewer_name))
    : "";

  const phoneDisplay =
    formatUsPhoneDisplay(input.phone) ?? input.phone?.trim() ?? "";
  const phoneHtml = phoneDisplay ? escapeHtml(phoneDisplay) : "";
  const ctaLabel = phoneHtml ? `Call/text us at ${phoneHtml}` : "Call now";
  const ctaHtml = `<span class="cta-icon">${CTA_PHONE_ICON}</span>${ctaLabel}`;

  const ratingLine =
    rating != null
      ? `${rating.toFixed(1)} · ${
          reviewCount != null
            ? `${reviewCount.toLocaleString()} reviews`
            : "reviews"
        }`
      : reviewCount != null
        ? `${reviewCount.toLocaleString()} reviews`
        : "";

  const starsRow = `<span style="color:#d97706;letter-spacing:0.02em;font-size:8pt;">★★★★★</span>
    <span style="margin-left:0.06in;font-size:8pt;font-weight:700;color:#18181b;">5/5</span>`;

  const reviewBody = quoteHtml
    ? `&ldquo;${quoteHtml}&rdquo;`
    : `&ldquo;Incredible service! Fast and professional.&rdquo;`;
  const reviewerLine = reviewerHtml
    ? `<p class="review-name">— ${reviewerHtml}</p>`
    : "";

  const qrCol = `<div class="qr-col">
    <p class="qr-col-label">${POSTCARD_QR_LABEL}</p>
    <div class="qr-slot"></div>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Postcard front</title>
  ${LOB_PRINT_FONT_LINKS}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 6.25in;
      height: 4.25in;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      font-family: ${LOB_PRINT_FONT_FAMILY};
      color: #18181b;
      background: #f5f0e8;
      position: relative;
    }
    .header {
      position: absolute;
      top: 0.22in;
      left: 0.38in;
      width: 5.49in;
    }
    .header-title {
      font-size: 12.5pt;
      font-weight: 700;
      line-height: 1.2;
      color: #064e3b;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .header-sub {
      font-size: 8pt;
      color: #78716c;
      margin-top: 0.04in;
    }
    .phone-wrap {
      position: absolute;
      top: 0.70in;
      left: ${PHONE_LEFT};
      width: ${PHONE_WIDTH};
    }
    .phone {
      width: 100%;
      align-self: stretch;
      height: 4.75in;
      background: #111827;
      border-radius: 0.22in;
      padding: 0.09in;
      position: relative;
    }
    .notch {
      position: absolute;
      top: 0.09in;
      left: 37.4%;
      width: 25.2%;
      height: 0.12in;
      background: #111827;
      border-radius: 0 0 0.08in 0.08in;
      z-index: 2;
    }
    .screen {
      width: 100%;
      height: 100%;
      background: #ffffff;
      border-radius: 0.16in;
      overflow: hidden;
      position: relative;
    }
    .hero {
      background: #064e3b;
      padding: 0.24in 0.14in 0.14in;
    }
    .eyebrow {
      font-size: 6pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #a7f3d0;
      margin-bottom: 0.05in;
    }
    .title {
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.15;
      color: #ffffff;
    }
    .body {
      padding: 0.12in 0.14in 0.1in;
      background: #ffffff;
    }
    .loc {
      font-size: 7.5pt;
      color: #78716c;
      margin-bottom: 0.07in;
    }
    .rating {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      color: #292524;
      background: #f5f0e8;
      border-radius: 999px;
      padding: 0.045in 0.08in;
      margin-bottom: 0.08in;
    }
    .cta {
      background: #047857;
      color: #ffffff;
      text-align: center;
      font-size: 8pt;
      font-weight: 700;
      border-radius: 0.07in;
      padding: 0.09in 0.06in;
      margin-bottom: 0.1in;
      line-height: 1.2;
    }
    .cta-icon {
      display: inline-block;
      vertical-align: middle;
      margin-right: 0.05in;
      line-height: 0;
    }
    .cta-icon svg {
      display: inline-block;
      vertical-align: middle;
    }
    .section {
      font-size: 8pt;
      font-weight: 700;
      color: #18181b;
      margin-bottom: 0.06in;
    }
    .review {
      border: 1px solid #e7e5e4;
      border-radius: 0.07in;
      padding: 0.09in;
      background: #ffffff;
    }
    .review-quote {
      margin-top: 0.05in;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #292524;
      max-height: 0.72in;
      overflow: hidden;
    }
    .review-name {
      margin-top: 0.06in;
      font-size: 7pt;
      color: #78716c;
    }
    .qr-col {
      position: absolute;
      top: ${POSTCARD_QR_SLOT.clusterTop};
      left: ${POSTCARD_QR_SLOT.clusterLeft};
      width: ${POSTCARD_QR_SLOT.clusterWidth};
    }
    .qr-col-label {
      position: absolute;
      top: 0;
      left: ${POSTCARD_QR_SLOT.slotLeft};
      width: ${POSTCARD_QR_SLOT.size};
      height: 0.16in;
      line-height: 0.16in;
      font-size: 6.5pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #18181b;
      text-align: center;
      white-space: nowrap;
    }
    .qr-slot {
      position: absolute;
      top: ${POSTCARD_QR_SLOT.slotTop};
      left: ${POSTCARD_QR_SLOT.slotLeft};
      width: ${POSTCARD_QR_SLOT.size};
      height: ${POSTCARD_QR_SLOT.size};
      background: #fff;
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="header-title">This is the site customers see when they scan.</p>
    <p class="header-sub">${escapeHtml(subline)}</p>
  </div>
  <div class="phone-wrap">
    <div class="phone">
      <div class="notch"></div>
      <div class="screen">
        <div class="hero">
          <p class="eyebrow">${category}</p>
          <p class="title">${name}</p>
        </div>
        <div class="body">
          ${locHtml ? `<p class="loc">${locHtml}</p>` : ""}
          ${ratingLine ? `<p class="rating">${escapeHtml(ratingLine)}</p>` : ""}
          <div class="cta">${ctaHtml}</div>
          <p class="section">What customers are saying</p>
          <div class="review">
            <div>${starsRow}</div>
            <p class="review-quote">${reviewBody}</p>
            ${reviewerLine}
          </div>
        </div>
      </div>
    </div>
  </div>
  ${qrCol}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Capitalize the first letter of each name part (e.g. "jane doe" → "Jane Doe"). */
function formatReviewerDisplayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length === 1) return part.toUpperCase();
      // Keep trailing period on initials like "J."
      if (/^[A-Za-z]\.$/.test(part)) return part.toUpperCase();
      return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .join(" ");
}
