/** Shared demo review shape — keep in a module with no server-only imports so client components can import it safely. */
export interface DemoReviewHighlight {
  rating?: number;
  excerpt: string;
  relative_time?: string;
  reviewer_name?: string;
}

export function parseReviewHighlights(
  value: unknown,
): DemoReviewHighlight[] | null {
  if (!Array.isArray(value)) return null;
  const out: DemoReviewHighlight[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const excerpt =
      typeof row.excerpt === "string" ? row.excerpt.trim() : "";
    if (!excerpt) continue;
    const rating =
      typeof row.rating === "number" && Number.isFinite(row.rating)
        ? row.rating
        : undefined;
    const relative_time =
      typeof row.relative_time === "string" ? row.relative_time : undefined;
    const reviewer_name =
      typeof row.reviewer_name === "string" ? row.reviewer_name.trim() : "";
    out.push({
      excerpt,
      rating,
      relative_time,
      ...(reviewer_name ? { reviewer_name } : {}),
    });
  }
  return out.length > 0 ? out : null;
}
