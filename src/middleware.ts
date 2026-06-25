import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCitySlug } from "@/lib/directory/slugs";
import {
  getRingReadyRobotsHeader,
  isRingReadyAllowedPath,
  isRingReadyHost,
  RING_READY_RESERVED_FIRST_SEGMENTS,
} from "@/lib/ringready-site";
import { updateSession } from "@/lib/supabase/middleware";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { shouldBypassRateLimit } from "@/lib/bot-detection";

const DIRECTORY_EXACT = new Set([
  "/",
  "/cities",
  "/categories",
  "/states",
  "/facebook",
  "/united-kingdom",
]);

const SKIP_RATE_LIMIT_PREFIXES = [
  "/api/",
  "/crm",
  "/dashboard",
  "/auth",
  "/sign-in",
  "/demo",
  "/privacy",
  "/terms",
  "/sms-disclosure",
  "/compliance",
  "/admin",
  "/_next",
  "/scrape-progress",
  "/extract-progress",
];

function isDirectoryPagePath(pathname: string): boolean {
  if (SKIP_RATE_LIMIT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (DIRECTORY_EXACT.has(normalized)) return true;
  if (pathname.startsWith("/united-kingdom/")) return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1;
}

function isPrefetchRequest(request: NextRequest): boolean {
  if (request.headers.get("next-router-prefetch") === "1") return true;
  if (request.headers.get("purpose") === "prefetch") return true;
  const secPurpose = request.headers.get("sec-purpose") ?? "";
  if (secPurpose.includes("prefetch")) return true;
  return false;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isRingReady = isRingReadyHost(host);

  const withRingReadyRobotsHeader = (response: NextResponse) => {
    if (!isRingReady) return response;
    const robotsHeader = getRingReadyRobotsHeader(pathname);
    if (robotsHeader) {
      response.headers.set("X-Robots-Tag", robotsHeader);
    }
    return response;
  };

  if (isRingReady && !isRingReadyAllowedPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    !isRingReady &&
    request.method === "GET" &&
    isDirectoryPagePath(pathname) &&
    !isPrefetchRequest(request) &&
    !shouldBypassRateLimit(request.headers.get("user-agent"))
  ) {
    const userAgent = request.headers.get("user-agent");
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit("directoryPage", ip, userAgent);
    if (!rateLimit.success) {
      return new NextResponse("Too many requests. Please try again later.", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...rateLimitHeaders(rateLimit),
        },
      });
    }
  }

  let sessionResponse: NextResponse | null = null;
  if (
    !isRingReady &&
    (pathname.startsWith("/crm") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/sign-in"))
  ) {
    sessionResponse = await updateSession(request);
  }

  if (pathname.startsWith("/demo")) {
    if (isRingReady) {
      return new NextResponse(null, { status: 404 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/crm";
    const redirect = NextResponse.redirect(url, 308);
    if (sessionResponse) {
      copyCookies(sessionResponse, redirect);
    }
    return redirect;
  }

  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match || isRingReady) {
    return withRingReadyRobotsHeader(sessionResponse ?? NextResponse.next());
  }

  const [, slug, secondSegment] = match;
  if (RING_READY_RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) {
    return sessionResponse ?? NextResponse.next();
  }

  if (!parseCitySlug(slug)) {
    return sessionResponse ?? NextResponse.next();
  }

  if (secondSegment.includes(".")) {
    return sessionResponse ?? NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  const redirect = NextResponse.redirect(url, 308);
  if (sessionResponse) {
    copyCookies(sessionResponse, redirect);
  }
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
