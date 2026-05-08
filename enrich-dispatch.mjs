/**
 * Thin entrypoint — run from repo root: node enrich-dispatch.mjs
 * Delegates to scrape/enrich-dispatch.mjs (loads .env.local from cwd or parent).
 */
import "./scrape/enrich-dispatch.mjs";
