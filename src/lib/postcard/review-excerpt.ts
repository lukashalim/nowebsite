import type { DemoReviewHighlight } from "@/lib/demo-review-types";

export interface PostcardReviewPick {
  excerpt: string;
  reviewer_name?: string;
}

/** Pick a 5★ excerpt for the phone mockup; truncate with … when too long. */
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

  const sorted = [...fiveStar].sort(
    (a, b) => a.excerpt.trim().length - b.excerpt.trim().length,
  );

  const chosen =
    sorted.find((review) => review.excerpt.trim().length <= maxChars) ??
    sorted[0];
  let excerpt = chosen.excerpt.trim();

  if (excerpt.length > maxChars) {
    excerpt = `${truncateAtWord(excerpt, maxChars - 1)}…`;
  }

  return {
    excerpt,
    ...(chosen.reviewer_name?.trim()
      ? { reviewer_name: chosen.reviewer_name.trim() }
      : {}),
  };
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
