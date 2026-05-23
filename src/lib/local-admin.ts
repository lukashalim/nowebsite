/**
 * Localhost-only admin tools (scraper dispatch, NDJSON extract, etc.).
 * Only enabled during `next dev` (NODE_ENV=development).
 */
export function isLocalAdminEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
