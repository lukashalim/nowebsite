import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCitySlug } from "@/lib/directory/slugs";

const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "demo",
  "crm",
  "admin",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "united-kingdom",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isRingReady = host.includes("ringreadysite.com");

  const withRobotsHeader = (response: NextResponse) => {
    if (isRingReady) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  };

  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return withRobotsHeader(NextResponse.next());

  const [, slug, secondSegment] = match;
  if (RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) {
    return withRobotsHeader(NextResponse.next());
  }

  if (!parseCitySlug(slug)) {
    return withRobotsHeader(NextResponse.next());
  }

  if (secondSegment.includes(".")) {
    return withRobotsHeader(NextResponse.next());
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  return withRobotsHeader(NextResponse.redirect(url, 308));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
