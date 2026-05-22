/**
 * Canonical site origin for metadata, sitemaps, and JSON-LD `url`.
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://example.com).
 */
const PRODUCTION_SITE_ORIGIN = "https://nowebsitebusinessleads.com";

export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_ORIGIN;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
