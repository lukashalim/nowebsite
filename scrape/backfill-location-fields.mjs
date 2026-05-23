/**
 * Backfill null city/state/postal_code on businesses_nowebsite using address parse,
 * lat/lng Census geocode, and ZIP lookup.
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/backfill-location-fields.mjs
 *   node ./scrape/backfill-location-fields.mjs --dry-run --limit 100
 *
 * Env: same Supabase as pipeline (loadEnvLocal). Optional EXTRACT_LOCAL_SCRAPE_ZIP unused here.
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import {
  applyLocationFallbacks,
  enrichLocationAsync,
} from "./lib/location-fallbacks.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const BATCH = Math.max(
  10,
  Number.parseInt(process.env.LOCATION_BACKFILL_BATCH ?? "50", 10) || 50,
);

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const cap = parseLimit(process.argv);
  const supabase = getSupabase();

  let scanned = 0;
  let updated = 0;
  let offset = 0;

  for (;;) {
    if (cap != null && scanned >= cap) break;

    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "place_id, name, address, city, state, postal_code, latitude, longitude",
      )
      .or("city.is.null,state.is.null")
      .order("place_id", { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (cap != null && scanned >= cap) break;
      scanned += 1;

      const base = {
        place_id: row.place_id,
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        latitude: row.latitude,
        longitude: row.longitude,
      };

      applyLocationFallbacks(base, {
        address: row.address,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
      });

      await enrichLocationAsync(base, {});

      if (!base.city && !base.state && !base.postal_code) continue;

      const patch = {};
      if (!row.city && base.city) patch.city = base.city;
      if (!row.state && base.state) patch.state = base.state;
      if (!row.postal_code && base.postal_code) patch.postal_code = base.postal_code;

      if (Object.keys(patch).length === 0) continue;

      if (dryRun) {
        console.log(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            patch,
          }),
        );
      } else {
        const { error: upErr } = await supabase
          .from(TABLE)
          .update(patch)
          .eq("place_id", row.place_id);
        if (upErr) {
          console.error(`Update failed ${row.place_id}:`, upErr.message);
          continue;
        }
      }
      updated += 1;
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  console.log(
    `backfill-location: scanned=${scanned} updated=${updated}${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
