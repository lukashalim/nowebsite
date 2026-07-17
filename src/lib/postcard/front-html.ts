/**
 * Lob 4×6 postcard front HTML (portrait bleed 4.25″×6.25″).
 * Print-safe: absolute layout, Lob-hosted fonts, no external CSS.
 */

import { parseReviewHighlights } from "@/lib/demo-review-types";

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
  const quote = highlights[0]?.excerpt?.trim() ?? "";
  const quoteHtml = quote
    ? escapeHtml(truncate(quote, 160))
    : "";
  const reviewer = highlights[0]?.reviewer_name?.trim();
  const reviewerHtml = reviewer ? escapeHtml(reviewer) : "";

  const phone = input.phone?.trim() ?? "";
  const phoneHtml = phone ? escapeHtml(phone) : "";

  const ratingLine =
    rating != null
      ? `${rating.toFixed(1)} stars${
          reviewCount != null ? ` · ${reviewCount.toLocaleString()} reviews` : ""
        }`
      : reviewCount != null
        ? `${reviewCount.toLocaleString()} reviews`
        : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Postcard front</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @font-face {
      font-family: "LobBody";
      font-style: normal;
      font-weight: 400;
      src: url("https://s3-us-west-2.amazonaws.com/assets.lob.com/fonts/open-sans/opensans-regular.ttf") format("truetype");
    }
    @font-face {
      font-family: "LobBody";
      font-style: normal;
      font-weight: 700;
      src: url("https://s3-us-west-2.amazonaws.com/assets.lob.com/fonts/open-sans/opensans-bold.ttf") format("truetype");
    }
    body {
      width: 4.25in;
      height: 6.25in;
      font-family: "LobBody", sans-serif;
      color: #18181b;
      background: #fafafa;
      position: relative;
      overflow: hidden;
    }
    .band {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1.55in;
      background: #064e3b;
    }
    .safe {
      position: absolute;
      top: 0.35in;
      left: 0.35in;
      right: 0.35in;
      bottom: 0.35in;
    }
    .eyebrow {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #a7f3d0;
      margin-bottom: 0.12in;
    }
    h1 {
      font-size: 22pt;
      font-weight: 700;
      line-height: 1.15;
      color: #fff;
      max-width: 3.4in;
    }
    .card {
      position: absolute;
      top: 1.85in;
      left: 0.35in;
      right: 0.35in;
      bottom: 0.9in;
      background: #fff;
      border: 1px solid #e4e4e7;
      border-radius: 0.08in;
      padding: 0.28in 0.28in 0.7in 0.28in;
    }
    .loc {
      font-size: 10pt;
      color: #3f3f46;
      margin-bottom: 0.14in;
    }
    .rating {
      display: inline-block;
      font-size: 11pt;
      font-weight: 700;
      color: #18181b;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 0.06in;
      padding: 0.08in 0.14in;
      margin-bottom: 0.18in;
    }
    .quote {
      font-size: 11pt;
      line-height: 1.4;
      color: #27272a;
      border-left: 3px solid #059669;
      padding-left: 0.14in;
      margin-top: 0.08in;
    }
    .quote-attr {
      font-size: 8.5pt;
      color: #71717a;
      margin-top: 0.1in;
      padding-left: 0.14in;
    }
    .cta {
      position: absolute;
      left: 0.28in;
      right: 0.28in;
      bottom: 0.28in;
      background: #047857;
      color: #fff;
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      border-radius: 0.06in;
      padding: 0.14in 0.12in;
    }
    .footer {
      position: absolute;
      left: 0.35in;
      right: 0.35in;
      bottom: 0.28in;
      text-align: center;
      font-size: 8.5pt;
      color: #52525b;
    }
    .footer strong {
      color: #064e3b;
    }
  </style>
</head>
<body>
  <div class="band"></div>
  <div class="safe">
    <p class="eyebrow">${category}</p>
    <h1>${name}</h1>
  </div>
  <div class="card">
    ${locHtml ? `<p class="loc">${locHtml}</p>` : ""}
    ${ratingLine ? `<p class="rating">${escapeHtml(ratingLine)}</p>` : ""}
    ${
      quoteHtml
        ? `<p class="quote">&ldquo;${quoteHtml}&rdquo;</p>${
            reviewerHtml
              ? `<p class="quote-attr">— ${reviewerHtml}</p>`
              : ""
          }`
        : `<p class="quote">A clean site with your services, reviews, and a clear call button — ready for customers who search locally.</p>`
    }
    ${
      phoneHtml
        ? `<div class="cta">Call ${phoneHtml}</div>`
        : `<div class="cta">See your live preview →</div>`
    }
  </div>
  <p class="footer">Preview of a website for <strong>${name}</strong> · flip for QR</p>
</body>
</html>`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
