/**
 * Cached Apify caller for lulzasaur/md-contractor-license-scraper.
 * Dedupes identical searchType+query+city+zip within a run.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApifyClient } from "apify-client";

export const MHIC_ACTOR_ID = "lulzasaur/md-contractor-license-scraper";

export function resolveApifyToken() {
  return (
    process.env.APIFY_TOKEN?.trim() ||
    process.env.APIFY_API_KEY?.trim() ||
    null
  );
}

function applyEnvFile(filePath, { overwrite }) {
  if (!existsSync(filePath)) return false;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const hash = val.indexOf(" #");
    if (hash !== -1) {
      val = val.slice(0, hash).trim();
    }
    if (overwrite || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return true;
}

/**
 * Load `.env` then let existing keys from `.env.local` (via loadEnvLocal) win.
 * Call after loadEnvLocal() so local values are not overwritten.
 */
export function loadDotEnvIfMissing() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
  for (const p of candidates) {
    if (applyEnvFile(p, { overwrite: false })) return p;
  }
  return null;
}

function cacheKey({ searchType, query, city, zip }) {
  return [searchType, query ?? "", city ?? "", zip ?? ""]
    .map((v) => String(v).trim().toLowerCase())
    .join("|");
}

export function createMhicSearcher(token, { waitSecs = 180 } = {}) {
  if (!token) {
    throw new Error("APIFY_TOKEN (or APIFY_API_KEY) is required");
  }
  const client = new ApifyClient({ token });
  const cache = new Map();
  let actorCalls = 0;
  let cacheHits = 0;

  async function search({ searchType, query, city, zip, maxResults }) {
    const input = { searchType, maxResults };
    if (query) input.query = query;
    if (city) input.city = city;
    if (zip) input.zip = zip;

    const key = cacheKey(input);
    if (cache.has(key)) {
      cacheHits += 1;
      return cache.get(key);
    }

    actorCalls += 1;
    const run = await client.actor(MHIC_ACTOR_ID).call(input, { waitSecs });
    const datasetId = run?.defaultDatasetId;
    if (!datasetId) {
      const empty = [];
      cache.set(key, empty);
      return empty;
    }
    const { items } = await client.dataset(datasetId).listItems({
      limit: maxResults && maxResults > 0 ? maxResults : 100,
    });
    const list = Array.isArray(items) ? items : [];
    cache.set(key, list);
    return list;
  }

  return {
    search,
    stats() {
      return { actorCalls, cacheHits };
    },
  };
}
