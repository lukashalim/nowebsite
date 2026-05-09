"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { DemoReviewHighlight } from "@/lib/demo-review-types";

interface DemoReviewCarouselProps {
  reviews: DemoReviewHighlight[];
}

function formatReviewExcerpt(raw: string): string {
  const text = raw.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!text) return "";

  // Heuristic: if it doesn't end with normal sentence punctuation, it's likely clipped.
  const likelyComplete = /[.!?…]"?$/.test(text);
  return likelyComplete ? text : `${text}...`;
}

function sortReviewsForDisplay(reviews: DemoReviewHighlight[]) {
  return [...reviews].sort((a, b) => {
    const ar = a.rating ?? 0;
    const br = b.rating ?? 0;
    if (ar !== br) return br - ar;
    return b.excerpt.length - a.excerpt.length;
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-4 ${i < Math.round(rating) ? "fill-amber-500" : ""}`}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-xs text-zinc-600">
        {rating.toFixed(1)} / 5
      </span>
    </div>
  );
}

export function DemoReviewCarousel({ reviews }: DemoReviewCarouselProps) {
  const ordered = useMemo(() => sortReviewsForDisplay(reviews), [reviews]);
  const [idx, setIdx] = useState(0);
  const current = ordered[idx] ?? null;
  if (!current) return null;
  const excerpt = formatReviewExcerpt(current.excerpt);

  const max = ordered.length;
  const atStart = idx === 0;
  const atEnd = idx === max - 1;

  return (
    <section className="mb-14 space-y-4" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-lg font-semibold text-zinc-900">
        What customers are saying
      </h2>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {typeof current.rating === "number" ? (
          <StarRow rating={current.rating} />
        ) : null}
        <p className="mt-4 whitespace-pre-wrap leading-relaxed text-zinc-800">
          &ldquo;{excerpt || "Customer feedback unavailable."}&rdquo;
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <BadgeCheck className="size-3.5" aria-hidden />
            {current.reviewer_name || "Verified customer"}
          </p>
          {current.relative_time ? (
            <p className="text-xs text-zinc-500">{current.relative_time}</p>
          ) : null}
        </div>
      </div>

      {max > 1 ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={atStart}
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </button>
          <p className="text-xs text-zinc-500">
            Review {idx + 1} of {max}
          </p>
          <button
            type="button"
            disabled={atEnd}
            onClick={() => setIdx((v) => Math.min(max - 1, v + 1))}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}

