/**
 * Lob 4×6 postcard front HTML (portrait bleed 4.25″×6.25″).
 * Compact phone-frame mockup of the listing preview (Lob WebKit print-safe).
 */

import { parseReviewHighlights } from "@/lib/demo-review-types";
import {
  LOB_PRINT_FONT_FAMILY,
  LOB_PRINT_FONT_LINKS,
} from "@/lib/postcard/lob-fonts";

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

  const rating =
    input.rating != null && Number.isFinite(Number(input.rating))
      ? Number(input.rating)
      : null;
  const reviewCount =
    input.reviewCount != null && Number.isFinite(Number(input.reviewCount))
      ? Math.round(Number(input.reviewCount))
      : null;

  const highlights = parseReviewHighlights(input.reviewHighlights) ?? [];
  const firstReview = highlights[0];
  const quote = firstReview?.excerpt?.trim() ?? "";
  const quoteHtml = quote ? escapeHtml(quote) : "";
  const reviewerHtml = firstReview?.reviewer_name?.trim()
    ? escapeHtml(firstReview.reviewer_name.trim())
    : "";

  const phone = input.phone?.trim() ?? "";
  const phoneHtml = phone ? escapeHtml(phone) : "";
  const ctaLabel = phoneHtml ? `Call ${phoneHtml}` : "Call now";

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

  const starScore =
    rating != null ? `${rating.toFixed(1)} / 5` : "5.0 / 5";

  const starsRow = `<span style="color:#d97706;letter-spacing:0.02em;font-size:8pt;">★★★★★</span>
    <span style="margin-left:0.06in;font-size:8pt;font-weight:700;color:#18181b;">${escapeHtml(starScore)}</span>`;

  const reviewBody = quoteHtml
    ? `&ldquo;${quoteHtml}&rdquo;`
    : `&ldquo;Your services, reviews, and a clear call button — ready for local customers.&rdquo;`;
  const reviewerLine = reviewerHtml
    ? `<p class="review-name">— ${reviewerHtml}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Postcard front</title>
  ${LOB_PRINT_FONT_LINKS}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 4.25in;
      height: 6.25in;
      margin: 0;
      padding: 0;
      font-family: ${LOB_PRINT_FONT_FAMILY};
      color: #18181b;
      background: #f5f0e8;
      position: relative;
    }
    .headline {
      position: absolute;
      top: 0.28in;
      left: 0.3in;
      right: 0.3in;
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      line-height: 1.2;
      color: #064e3b;
    }
    .headline .brand {
      color: #d97706;
    }
    .phone {
      position: absolute;
      top: 0.72in;
      left: 0.78in;
      width: 2.7in;
      height: 4.75in;
      background: #111827;
      border-radius: 0.22in;
      padding: 0.09in;
    }
    .notch {
      position: absolute;
      top: 0.09in;
      left: 50%;
      margin-left: -0.34in;
      width: 0.68in;
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
  </style>
</head>
<body>
  <p class="headline">Get a <span class="brand">Ring Ready</span> website.</p>
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
        <div class="cta">${ctaLabel}</div>
        <p class="section">What customers are saying</p>
        <div class="review">
          <div>${starsRow}</div>
          <p class="review-quote">${reviewBody}</p>
          ${reviewerLine}
        </div>
      </div>
    </div>
  </div>
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
