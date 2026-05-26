/**
 * Backfill region + region_code on businesses_nowebsite.
 * Usage (from scrape/): node scripts/backfill-region-fields.mjs
 */

import { loadEnvLocal, getSupabase } from "../lib/scrape-pipeline/index.mjs";
import { deriveRegionFields } from "../lib/region-fields.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const BATCH = 500;

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();
  let from = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("place_id, city, state, country, region, region_code")
      .range(from, from + BATCH - 1);

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const next = deriveRegionFields(row);
      if (
        row.region === next.region &&
        row.region_code === next.region_code
      ) {
        continue;
      }
      const { error: upErr } = await supabase
        .from(TABLE)
        .update({
          region: next.region,
          region_code: next.region_code,
        })
        .eq("place_id", row.place_id);
      if (upErr) {
        console.error(`Update ${row.place_id}:`, upErr.message);
      } else {
        updated += 1;
      }
    }

    from += rows.length;
    if (rows.length < BATCH) break;
    console.error(`Scanned ${from}, updated ${updated}…`);
  }

  console.error(`Done. Updated ${updated} row(s).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
