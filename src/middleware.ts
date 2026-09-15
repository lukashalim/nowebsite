import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  canAccessAdmin,
  safeAdminNextPath,
} from "@/lib/admin/auth";
import {
  REPORT_COOKIE_NAME,
  canAccessClientReport,
  parseReportPath,
  reportLoginPath,
  safeReportNextPath,
} from "@/lib/client-report/auth";
import { parseCitySlug } from "@/lib/directory/slugs";
import {
  clientSiteApexHostname,
  getClientSiteByHost,
  isClientSiteAllowedPath,
} from "@/lib/client-sites";
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
  "/report",
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
  const clientSite = getClientSiteByHost(host);

  if (clientSite) {
    const hostname = host.split(":")[0]?.toLowerCase() ?? "";
    const apex = clientSiteApexHostname(clientSite);
    if (
      process.env.NODE_ENV === "production" &&
      hostname === `www.${apex}`
    ) {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      url.hostname = apex;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }

    if (!isClientSiteAllowedPath(pathname)) {
      return new NextResponse(null, { status: 404 });
    }

    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = `/live/${clientSite.id}`;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  if (pathname === "/live" || pathname.startsWith("/live/")) {
    return new NextResponse(null, { status: 404 });
  }

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

  if (pathname.startsWith("/admin")) {
    const access = await canAccessAdmin({
      host,
      token: request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    });
    const isLogin = pathname === "/admin/login";

    if (access === "not_found") {
      return new NextResponse(null, { status: 404 });
    }

    if (isLogin && access === "allow") {
      const nextPath = safeAdminNextPath(
        request.nextUrl.searchParams.get("next"),
      );
      const url = request.nextUrl.clone();
      const parsedNext = new URL(nextPath, request.nextUrl.origin);
      url.pathname = parsedNext.pathname;
      url.search = parsedNext.search;
      return NextResponse.redirect(url);
    }

    if (!isLogin && access === "login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      const nextValue = `${pathname}${request.nextUrl.search}`;
      url.search = `?next=${encodeURIComponent(nextValue)}`;
      return NextResponse.redirect(url);
    }

    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (pathname === "/report" || pathname.startsWith("/report/")) {
    const parsed = parseReportPath(pathname);
    if (!parsed) {
      return new NextResponse(null, { status: 404 });
    }

    const access = await canAccessClientReport({
      siteId: parsed.siteId,
      host,
      reportToken: request.cookies.get(REPORT_COOKIE_NAME)?.value,
      adminToken: request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    });

    if (access === "not_found") {
      return new NextResponse(null, { status: 404 });
    }

    if (parsed.isLogin && access === "allow") {
      const nextPath = safeReportNextPath(
        parsed.siteId,
        request.nextUrl.searchParams.get("next"),
      );
      const url = request.nextUrl.clone();
      const parsedNext = new URL(nextPath, request.nextUrl.origin);
      url.pathname = parsedNext.pathname;
      url.search = parsedNext.search;
      return NextResponse.redirect(url);
    }

    if (!parsed.isLogin && !parsed.isLogout && access === "login") {
      const url = request.nextUrl.clone();
      url.pathname = reportLoginPath(parsed.siteId);
      const nextValue = `${pathname}${request.nextUrl.search}`;
      url.search = `?next=${encodeURIComponent(nextValue)}`;
      return NextResponse.redirect(url);
    }

    const reportResponse = NextResponse.next();
    reportResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    return reportResponse;
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
