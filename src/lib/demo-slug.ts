const MAX_SLUG_LEN = 48;

/** Google Maps place ids used in legacy /demo/ChIJ… URLs. */
export function isLikelyGooglePlaceId(s: string): boolean {
  return /^ChIJ[A-Za-z0-9_-]+$/.test(String(s ?? "").trim());
}

export function slugifyBusinessNameForDemo(
  name: string | null | undefined,
  placeId: string,
): string {
  const fromName = String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  if (fromName.length >= 3) {
    return fromName.slice(0, MAX_SLUG_LEN);
  }
  const tail = String(placeId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(-10);
  const fallback = `biz${tail}`.slice(0, MAX_SLUG_LEN);
  return fallback.length >= 3 ? fallback : "business";
}

/** Path segment for links and canonical URLs (pretty slug when present). */
export function demoPathSegment(b: {
  demo_slug?: string | null;
  place_id: string;
}): string {
  const slug = b.demo_slug?.trim().toLowerCase();
  if (slug) return encodeURIComponent(slug);
  return encodeURIComponent(b.place_id);
}

export function tenantDemoPublicPath(username: string, slug: string): string {
  return `/${encodeURIComponent(username.trim())}/${encodeURIComponent(slug.trim())}`;
}

/** Legacy global demo path — prefer tenantDemoPublicPath when username is known. */
export function demoPublicPath(
  b: {
    demo_slug?: string | null;
    place_id: string;
  },
  username?: string | null,
): string {
  const segment = demoPathSegment(b);
  const slug = b.demo_slug?.trim() || decodeURIComponent(segment);
  if (username?.trim()) {
    return tenantDemoPublicPath(username, slug);
  }
  return `/demo/${segment}`;
}
