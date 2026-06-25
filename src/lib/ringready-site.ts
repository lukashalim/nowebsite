import type { Metadata } from "next";
import { headers } from "next/headers";
import { tenantDemoPublicPath } from "@/lib/demo-slug";

export const RING_READY_ORIGIN = "https://ringreadysite.com";

export const RING_READY_LEGAL_PATHS = [
  "/privacy",
  "/terms",
  "/sms-disclosure",
  "/compliance",
] as const;

/** Homepage and compliance pages indexed for A2P 10DLC audit visibility. */
export const RING_READY_INDEXABLE_PATHS = ["/", ...RING_READY_LEGAL_PATHS] as const;

export const RING_READY_RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "auth",
  "sign-in",
  "demo",
  "crm",
  "dashboard",
  "admin",
  "privacy",
  "terms",
  "sms-disclosure",
  "compliance",
  "alternatives",
  "blog",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "united-kingdom",
]);

export function isRingReadyHost(host: string): boolean {
  return host.includes("ringreadysite.com");
}

export function ringReadyAbsoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${RING_READY_ORIGIN}${normalized}`;
}

/** Public demo page URL on ringreadysite.com for CRM and outreach links. */
export function ringReadyTenantDemoUrl(username: string, slug: string): string {
  return ringReadyAbsoluteUrl(tenantDemoPublicPath(username, slug));
}

export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function isRingReadyLegalPath(pathname: string): boolean {
  return RING_READY_LEGAL_PATHS.includes(
    normalizePathname(pathname) as (typeof RING_READY_LEGAL_PATHS)[number],
  );
}

export function isRingReadyDemoPath(pathname: string): boolean {
  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return false;
  const [, slug, secondSegment] = match;
  if (RING_READY_RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) return false;
  if (secondSegment.includes(".")) return false;
  return true;
}

export function isRingReadyInfrastructurePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export function isRingReadyAllowedPath(pathname: string): boolean {
  if (isRingReadyInfrastructurePath(pathname)) return true;
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return true;
  if (isRingReadyLegalPath(normalized)) return true;
  return isRingReadyDemoPath(pathname);
}

export function getRingReadyPageRobots(pathname: string): Metadata["robots"] {
  const normalized = normalizePathname(pathname);
  if (
    normalized === "/" ||
    isRingReadyLegalPath(pathname)
  ) {
    return { index: true, follow: true };
  }
  if (isRingReadyDemoPath(pathname)) {
    return { index: false, follow: true };
  }
  return undefined;
}

export function getRingReadyRobotsHeader(pathname: string): string | null {
  const robots = getRingReadyPageRobots(pathname);
  if (!robots || typeof robots === "string") return null;
  const index = robots.index ?? true;
  const follow = robots.follow ?? true;
  return `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}`;
}

export function getRingReadyCanonical(pathname: string): string {
  return ringReadyAbsoluteUrl(normalizePathname(pathname));
}

export const RING_READY_INDEXABLE_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
};

export function buildRingReadyLegalPageMetadata(
  metadata: Pick<Metadata, "title" | "description">,
  options: { isRingReady: boolean; canonical: string },
): Metadata {
  return {
    ...metadata,
    alternates: { canonical: options.canonical },
    robots: options.isRingReady ? RING_READY_INDEXABLE_ROBOTS : undefined,
  };
}

export async function isRingReadyRequest(): Promise<boolean> {
  const host = (await headers()).get("host") ?? "";
  return isRingReadyHost(host);
}
