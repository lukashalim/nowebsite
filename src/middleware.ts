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
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return NextResponse.next();

  const [, slug, secondSegment] = match;
  if (RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) {
    return NextResponse.next();
  }

  if (!parseCitySlug(slug)) {
    return NextResponse.next();
  }

  if (secondSegment.includes(".")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
