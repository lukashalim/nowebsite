/**
 * Localhost-only admin tools (scraper dispatch, NDJSON extract, etc.).
 * Disabled on Vercel; enabled for local/private hosts and `next dev`.
 */

function isPrivateLocalHost(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/**
 * @param host — optional `Host` header (required for reliable checks in route handlers)
 */
export function isLocalAdminEnabled(host?: string | null): boolean {
  if (process.env.ENABLE_LOCAL_ADMIN === "0") {
    return false;
  }
  if (process.env.VERCEL === "1") {
    return false;
  }
  if (host && isPrivateLocalHost(host)) {
    return true;
  }
  if (process.env.ENABLE_LOCAL_ADMIN === "1") {
    return true;
  }
  return process.env.NODE_ENV === "development";
}
