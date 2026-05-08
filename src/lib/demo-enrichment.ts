import type { ContactEnrichment } from "@/lib/contact-enrichment-schema";

export function normalizeHttpUrl(s: string | undefined | null): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  if (/^[a-z0-9][a-z0-9-]*[a-z0-9]*\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return null;
}

export function extractUrlsFromEmailsAndSocial(
  raw: ContactEnrichment["emails_and_social"],
): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const n = normalizeHttpUrl(item);
        if (n) out.push(n);
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        for (const key of ["url", "link", "href"] as const) {
          const v = o[key];
          if (typeof v === "string") {
            const n = normalizeHttpUrl(v);
            if (n) out.push(n);
            break;
          }
        }
      }
    }
    return out;
  }
  return [];
}

export function enrichmentDirectUrls(e: ContactEnrichment | null): string[] {
  if (!e) return [];
  const keys = [
    "linkedin",
    "twitter",
    "instagram",
    "youtube",
    "facebook",
  ] as const;
  const out: string[] = [];
  for (const k of keys) {
    const n = normalizeHttpUrl(e[k]);
    if (n) out.push(n);
  }
  return out;
}

/** Dedupe by normalized URL string (lowercase origin + path). */
function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    try {
      const url = new URL(u);
      const key = `${url.hostname.toLowerCase()}${url.pathname}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u);
    } catch {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

export function collectSameAsUrls(
  facebookUrl: string | null | undefined,
  googleMapsLink: string | null | undefined,
  enrichment: ContactEnrichment | null,
): string[] {
  const primary = [facebookUrl, googleMapsLink]
    .map((s) => (s ? normalizeHttpUrl(s) : null))
    .filter((u): u is string => u != null);
  const fromEnrich = [
    ...enrichmentDirectUrls(enrichment),
    ...extractUrlsFromEmailsAndSocial(enrichment?.emails_and_social),
  ];
  return dedupeUrls([...primary, ...fromEnrich]);
}

function labelForUrl(href: string): string {
  try {
    const h = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    if (h.includes("linkedin")) return "LinkedIn";
    if (h.includes("instagram")) return "Instagram";
    if (h.includes("youtube") || h === "youtu.be") return "YouTube";
    if (h.includes("twitter") || h === "x.com") return "X";
    if (h.includes("facebook")) return "Facebook";
    return "Social";
  } catch {
    return "Social";
  }
}

/** Social URLs from enrichment only, excluding same host as Maps/Facebook primary links. */
export function enrichmentSocialLinksForUi(b: {
  facebook_url: string | null;
  google_maps_link: string | null;
  enrichment: ContactEnrichment | null;
}): { href: string; label: string }[] {
  const urls = dedupeUrls([
    ...enrichmentDirectUrls(b.enrichment),
    ...extractUrlsFromEmailsAndSocial(b.enrichment?.emails_and_social),
  ]);
  const skipHosts = new Set<string>();
  for (const raw of [b.facebook_url, b.google_maps_link]) {
    const n = normalizeHttpUrl(raw ?? null);
    if (!n) continue;
    try {
      skipHosts.add(new URL(n).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      /* ignore */
    }
  }
  const out: { href: string; label: string }[] = [];
  for (const href of urls) {
    try {
      const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
      if (skipHosts.has(host)) continue;
      if (host.includes("facebook.com") && b.facebook_url) continue;
      if (
        (host.includes("google.com") || host.includes("goo.gl")) &&
        b.google_maps_link
      )
        continue;
      out.push({ href, label: labelForUrl(href) });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function extractDemoPublicEmail(
  enrichment: ContactEnrichment | null,
): string | null {
  if (!enrichment) return null;
  const single = enrichment.email?.trim();
  if (single && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(single)) return single;
  const emails = enrichment.emails;
  if (Array.isArray(emails)) {
    for (const x of emails) {
      if (
        typeof x === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim())
      ) {
        return x.trim();
      }
    }
  }
  return null;
}

export function isDemoEmailVisible(): boolean {
  const v = process.env.NEXT_PUBLIC_DEMO_SHOW_EMAIL?.trim()?.toLowerCase();
  return v === "1" || v === "true";
}

export function openStreetMapLink(
  lat: number | null,
  lng: number | null,
): string | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

const META_DESC_MAX = 155;

export function truncateForMeta(s: string, max = META_DESC_MAX): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** First paragraph or line, trimmed, for list preview. */
export function salesSummaryOneLine(
  enrichment: ContactEnrichment | null,
  maxLen = 140,
): string | null {
  const raw = enrichment?.sales_summary?.trim();
  if (!raw) return null;
  const firstBlock = raw.split(/\n\n+/)[0]?.trim() ?? raw;
  const oneLine = firstBlock.split("\n")[0]?.trim() ?? firstBlock;
  if (!oneLine) return null;
  return truncateForMeta(oneLine, maxLen);
}

export function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
