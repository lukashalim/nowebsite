export interface AngiCompetitor {
  name: string;
  url?: string | null;
  title?: string | null;
}

export function parseAngiCompetitorsJson(raw: unknown): AngiCompetitor[] {
  if (!Array.isArray(raw)) return [];
  const out: AngiCompetitor[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = (row as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      url:
        typeof (row as { url?: unknown }).url === "string"
          ? (row as { url: string }).url
          : null,
      title:
        typeof (row as { title?: unknown }).title === "string"
          ? (row as { title: string }).title
          : null,
    });
  }
  return out;
}
