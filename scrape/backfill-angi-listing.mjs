/**
 * Backfill Angi listing detection on home-services businesses via DataForSEO SERP
 * (query: `{name} {city} {state} angi`) + Playwright Angi Approved scrape.
 *
 *   npm run angi:backfill -- --dry-run --limit 20
 *   npm run angi:backfill -- --limit 50
 *   npm run angi:backfill -- --force --states=Maryland,"District Of Columbia"
 *
 * Env: DATAFORSEO_LOGIN (or DATAFORSEO_USERNAME) + DATAFORSEO_PASSWORD,
 *   Supabase via loadEnvLocal(). Playwright Chromium required for Approved scrape.
 * Optional: ANGI_BACKFILL_BATCH (default 25), ANGI_BACKFILL_SLEEP_MS (default 800),
 *   ANGI_BACKFILL_STATES.
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import { fetchHomeServicesSlugs } from "./lib/fetch-home-services-slugs.mjs";
import {
  detectAngiListingForBusiness,
  resolveDataForSeoCredentials,
} from "../src/lib/angi-listing.ts";
import { closeAngiProfileBrowser } from "../src/lib/angi-profile-scrape.ts";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const BATCH = Math.max(
  5,
  Number.parseInt(process.env.ANGI_BACKFILL_BATCH ?? "25", 10) || 25,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.ANGI_BACKFILL_SLEEP_MS ?? "800", 10) || 800,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const STATE_ALIAS_TO_DB = new Map([
  ["md", "Maryland"],
  ["maryland", "Maryland"],
  ["dc", "District Of Columbia"],
  ["district of columbia", "District Of Columbia"],
]);

function parseStatesArg(argv) {
  for (const arg of argv.slice(2)) {
    const m = /^--states=(.*)$/i.exec(arg);
    if (m) {
      return m[1]
        .split(",")
        .map((s) => s.replace(/^['"]|['"]$/g, "").trim())
        .filter(Boolean);
    }
  }
  const env = process.env.ANGI_BACKFILL_STATES?.trim();
  if (!env) return null;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveStateFilterValues(rawStates) {
  if (!rawStates?.length) return null;
  const resolved = new Set();
  for (const raw of rawStates) {
    const key = raw.trim().toLowerCase();
    const mapped = STATE_ALIAS_TO_DB.get(key);
    if (mapped) {
      resolved.add(mapped);
      continue;
    }
    resolved.add(raw.trim());
  }
  if (resolved.has("Maryland")) {
    resolved.add("MD");
  }
  return [...resolved];
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const cap = parseLimit(process.argv);

  const credentials = resolveDataForSeoCredentials();
  if (!credentials && !dryRun) {
    throw new Error(
      "DATAFORSEO_LOGIN (or DATAFORSEO_USERNAME) and DATAFORSEO_PASSWORD are required in .env.local",
    );
  }

  const supabase = getSupabase();
  const homeServicesSlugs = await fetchHomeServicesSlugs(supabase);
  const stateFilter = resolveStateFilterValues(parseStatesArg(process.argv));
  if (stateFilter?.length) {
    console.log(`State filter: ${stateFilter.join(", ")}`);
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let offset = 0;

  for (;;) {
    if (cap != null && scanned >= cap) break;

    const rangeStart = force ? offset : 0;

    let q = supabase
      .from(TABLE)
      .select(
        "place_id, name, address, city, state, phone, country, main_category, business_type, directory_category_slug, has_angi_listing",
      )
      .eq("is_invalid", false)
      .eq("has_website", false)
      .eq("country", "US")
      .in("directory_category_slug", homeServicesSlugs)
      .order("place_id", { ascending: true })
      .range(rangeStart, rangeStart + BATCH - 1);

    if (stateFilter?.length) {
      q = q.in("state", stateFilter);
    }

    if (!force) {
      q = q.is("angi_listing_checked_at", null);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (cap != null && scanned >= cap) break;
      scanned += 1;

      if (!row.name?.trim() || (!row.city?.trim() && !row.state?.trim())) {
        skipped += 1;
        console.warn(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            skipped: "missing_name_or_location",
          }),
        );
        continue;
      }

      const input = {
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        phone: row.phone,
        country: row.country ?? "US",
        mainCategory: row.main_category,
        businessType: row.business_type,
        directoryCategorySlug: row.directory_category_slug,
      };

      if (dryRun) {
        console.log(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            city: row.city,
            state: row.state,
            dryRun: true,
          }),
        );
        updated += 1;
        continue;
      }

      const detected = await detectAngiListingForBusiness(input, credentials);
      if (!detected.ok) {
        skipped += 1;
        console.error(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            error: detected.error,
            httpStatus: detected.httpStatus,
          }),
        );
        if (detected.httpStatus === 429) {
          console.warn("Rate limited (429); sleeping 5s...");
          await sleep(5000);
        }
        continue;
      }

      const { result } = detected;
      const { error: upErr } = await supabase
        .from(TABLE)
        .update({
          has_angi_listing: result.hasListing,
          angi_listing_url: result.url,
          angi_listing_title: result.title,
          angi_listing_confidence: result.confidence,
          angi_competitors: result.competitors,
          angi_listing_checked_at: result.checkedAt,
          angi_owner_name: result.angiOwnerName ?? null,
        })
        .eq("place_id", row.place_id);

      if (upErr) {
        console.error(`Update failed ${row.place_id}:`, upErr.message);
        skipped += 1;
        continue;
      }

      console.log(
        JSON.stringify({
          place_id: row.place_id,
          name: row.name,
          has_angi_listing: result.hasListing,
          confidence: Number(result.confidence.toFixed(3)),
          verification: result.verification ?? null,
          scrapeSignals: result.scrapeSignals ?? [],
          angi_owner_name: result.angiOwnerName ?? null,
          url: result.url,
          competitors: result.competitors.map((c) => c.name),
        }),
      );
      updated += 1;

      if (SLEEP_MS > 0) {
        await sleep(SLEEP_MS);
      }
    }

    if (rows.length < BATCH) break;
    if (force) {
      offset += BATCH;
    }
  }

  await closeAngiProfileBrowser();

  console.log(
    `backfill-angi-listing: scanned=${scanned} updated=${updated} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeAngiProfileBrowser();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
