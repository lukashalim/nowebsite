import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCitySlug } from "@/lib/directory/slugs";
import { updateSession } from "@/lib/supabase/middleware";

const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "auth",
  "sign-in",
  "demo",
  "crm",
  "admin",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "united-kingdom",
]);

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isRingReady = host.includes("ringreadysite.com");

  const withRobotsHeader = (response: NextResponse) => {
    if (isRingReady) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  };

  let sessionResponse: NextResponse | null = null;
  if (pathname.startsWith("/crm") || pathname.startsWith("/auth") || pathname.startsWith("/sign-in")) {
    sessionResponse = await updateSession(request);
  }

  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) {
    return withRobotsHeader(sessionResponse ?? NextResponse.next());
  }

  const [, slug, secondSegment] = match;
  if (RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) {
    return withRobotsHeader(sessionResponse ?? NextResponse.next());
  }

  if (!parseCitySlug(slug)) {
    return withRobotsHeader(sessionResponse ?? NextResponse.next());
  }

  if (secondSegment.includes(".")) {
    return withRobotsHeader(sessionResponse ?? NextResponse.next());
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  const redirect = NextResponse.redirect(url, 308);
  if (sessionResponse) {
    copyCookies(sessionResponse, redirect);
  }
  return withRobotsHeader(redirect);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
