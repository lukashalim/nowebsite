/**
 * Fix mis-parsed city values (e.g. "8", "1, Fork") via prefix sanitization and Census reverse geocode.
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/fix-bad-location-cities.mjs --dry-run --limit 20
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/fix-bad-location-cities.mjs
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import {
  enrichLocationAsync,
  isLikelyBadUsCity,
  sanitizeParsedUsCity,
} from "./lib/location-fallbacks.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const BATCH = Math.max(
  10,
  Number.parseInt(process.env.LOCATION_BACKFILL_BATCH ?? "25", 10) || 25,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.LOCATION_FIX_SLEEP_MS ?? "150", 10) || 150,
);

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBadCityRow(row) {
  return isLikelyBadUsCity(row.city);
}

async function resolveCityPatch(row) {
  const sanitized = sanitizeParsedUsCity(row.city);
  if (sanitized && !isLikelyBadUsCity(sanitized)) {
    return { city: sanitized };
  }

  if (row.latitude == null || row.longitude == null) {
    return { city: null };
  }

  const base = {
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    country: row.country ?? "US",
  };

  await enrichLocationAsync(base, {});

  const patch = {};
  if (base.city !== row.city) {
    patch.city = base.city;
  }
  if (!row.postal_code && base.postal_code) {
    patch.postal_code = base.postal_code;
  }
  if (Object.keys(patch).length === 0) {
    return null;
  }
  return patch;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const cap = parseLimit(process.argv);
  const supabase = getSupabase();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let offset = 0;

  for (;;) {
    if (cap != null && scanned >= cap) break;

    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "place_id, name, city, state, postal_code, latitude, longitude, country",
      )
      .eq("is_invalid", false)
      .not("city", "is", null)
      .order("place_id", { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!isBadCityRow(row)) continue;
      if (cap != null && scanned >= cap) break;
      scanned += 1;

      const patch = await resolveCityPatch(row);
      if (!patch) {
        skipped += 1;
        console.warn(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            city: row.city,
            state: row.state,
            skipped: true,
          }),
        );
        continue;
      }

      if (dryRun) {
        console.log(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            from: row.city,
            patch,
            dryRun: true,
          }),
        );
      } else {
        const { error: upErr } = await supabase
          .from(TABLE)
          .update(patch)
          .eq("place_id", row.place_id);
        if (upErr) {
          skipped += 1;
          console.error(`Update failed ${row.place_id}:`, upErr.message);
          continue;
        }
        console.log(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            from: row.city,
            to: patch.city,
          }),
        );
      }

      updated += 1;
      if (SLEEP_MS > 0) {
        await sleep(SLEEP_MS);
      }
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  console.log(
    `fix-bad-location-cities: scanned=${scanned} updated=${updated} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
