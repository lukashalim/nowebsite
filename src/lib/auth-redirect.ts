import { CRM_BASE_PATH } from "@/lib/crm-path";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** Origin derived from the incoming HTTP request (preferred for auth redirects). */
export function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const hostname = host.split(":")[0] ?? host;

  if (isLocalHostname(hostname)) {
    return `${requestUrl.protocol}//${host}`;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (siteUrl) {
    return siteUrl;
  }

  return requestUrl.origin;
}

/** OAuth callback URL — no query string so it matches Supabase redirect allow-list entries exactly. */
export function buildOAuthCallbackUrl(request: Request): string {
  return `${getRequestOrigin(request)}/auth/callback`;
}

export function getPostAuthNextPath(request: Request): string {
  const next = new URL(request.url).searchParams.get("next") ?? CRM_BASE_PATH;
  return next.startsWith("/") ? next : CRM_BASE_PATH;
}
