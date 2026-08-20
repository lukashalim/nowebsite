import type { DemoReviewHighlight } from "@/lib/demo-review-types";

export interface PostcardReviewPick {
  excerpt: string;
  reviewer_name?: string;
}

/** Pick a 5★ excerpt for the phone mockup; truncate at sentence boundaries when possible. */
export function pickPostcardReviewExcerpt(
  highlights: DemoReviewHighlight[],
  maxChars = 85,
): PostcardReviewPick | null {
  const fiveStar = highlights.filter(
    (review) =>
      review.rating != null &&
      Math.round(review.rating) === 5 &&
      review.excerpt.trim(),
  );
  if (fiveStar.length === 0) return null;

  const chosen = pickBestReview(fiveStar, maxChars);
  if (!chosen) return null;

  let excerpt = chosen.excerpt.trim();
  if (excerpt.length > maxChars) {
    excerpt = truncateForPostcard(excerpt, maxChars);
    if (!/[.!?]$/.test(excerpt)) {
      excerpt = `${excerpt}…`;
    }
  }

  return {
    excerpt,
    ...(chosen.reviewer_name?.trim()
      ? { reviewer_name: chosen.reviewer_name.trim() }
      : {}),
  };
}

function pickBestReview(
  reviews: DemoReviewHighlight[],
  maxChars: number,
): DemoReviewHighlight | null {
  const fits = reviews.filter((review) => review.excerpt.trim().length <= maxChars);
  if (fits.length > 0) {
    return [...fits].sort(
      (a, b) => a.excerpt.trim().length - b.excerpt.trim().length,
    )[0];
  }

  const sentenceClean = reviews
    .map((review) => ({
      review,
      clipped: truncateForPostcard(review.excerpt.trim(), maxChars),
    }))
    .filter(
      ({ clipped }) =>
        clipped.length <= maxChars && /[.!?]$/.test(clipped),
    )
    .sort((a, b) => b.clipped.length - a.clipped.length);

  if (sentenceClean.length > 0) {
    return sentenceClean[0].review;
  }

  return [...reviews].sort(
    (a, b) => a.excerpt.trim().length - b.excerpt.trim().length,
  )[0];
}

function truncateForPostcard(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const window = text.slice(0, maxLen + 1);
  const minSentenceLen = Math.max(20, Math.floor(maxLen * 0.35));

  for (let i = window.length - 1; i >= 0; i--) {
    const ch = window[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    const next = window[i + 1];
    if (next !== undefined && next !== " " && next !== '"') continue;

    const candidate = window.slice(0, i + 1).trim();
    if (candidate.length >= minSentenceLen) {
      return candidate;
    }
  }

  const wordClip = truncateAtWord(text, maxLen);
  if (wordClip.length <= maxLen) return wordClip;

  return text.slice(0, maxLen).trim();
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const clipped = text.slice(0, maxLen + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxLen * 0.5)) {
    return clipped.slice(0, lastSpace).trim();
  }

  return text.slice(0, maxLen).trim();
}
