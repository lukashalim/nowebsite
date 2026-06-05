/**
 * Copy rows from public.businesses → public.businesses_nowebsite for the CRM demo cohort:
 *   has_website = false, rating >= min, reviews between min and max (defaults match src/lib/crm-params.ts).
 *
 * Run from scrape/:  npm run sync-nowebsite-from-businesses -- --limit 5000
 *
 * Env:
 *   SYNC_SOURCE_TABLE (default businesses)
 *   SYNC_TARGET_TABLE (default businesses_nowebsite)
 *   CRM_MIN_REVIEWS (default 25), CRM_MAX_REVIEWS (default 199), CRM_MIN_RATING (default 4)
 *   SYNC_SOURCE_SELECT — optional override for SELECT columns (if your source schema differs)
 *   SYNC_PAGE_SIZE (default 500)
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";

const DEFAULT_SELECT =
  "place_id, name, address, city, state, country, postal_code, latitude, longitude, main_category, business_type, rating, reviews, is_spending_on_ads, can_claim, has_website, phone, google_maps_link, facebook_url, contact_count, competitive_weakness, contact_enrichment, enriched_at, scraped_at";

function parseLimitArg(argv) {
  const idx = argv.findIndex((a) => a === "--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const eq = argv.find((a) => /^--limit=/.test(a));
  if (eq) {
    const n = Number.parseInt(eq.split("=")[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const envN = Number.parseInt(process.env.SYNC_TOTAL_LIMIT ?? "", 10);
  return Number.isFinite(envN) && envN > 0 ? envN : null;
}

function numEnv(name, def) {
  const n = Number.parseFloat(String(process.env[name] ?? def));
  return Number.isFinite(n) ? n : def;
}

function stampRows(rows) {
  const at = new Date().toISOString();
  return rows.map((r) => ({
    ...r,
    contact_count:
      r.contact_count != null && Number.isFinite(Number(r.contact_count))
        ? Number(r.contact_count)
        : 0,
    source_snapshot_at: at,
  }));
}

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();

  const source = process.env.SYNC_SOURCE_TABLE?.trim() || "businesses";
  const target = process.env.SYNC_TARGET_TABLE?.trim() || "businesses_nowebsite";
  const selectList = process.env.SYNC_SOURCE_SELECT?.trim() || DEFAULT_SELECT;
  const pageSize = Math.max(
    50,
    Number.parseInt(process.env.SYNC_PAGE_SIZE ?? "500", 10) || 500,
  );

  const minRev = numEnv("CRM_MIN_REVIEWS", 25);
  const maxRev = numEnv("CRM_MAX_REVIEWS", 199);
  const minRating = numEnv("CRM_MIN_RATING", 4);

  const hardCap = parseLimitArg(process.argv);
  let totalUpserted = 0;
  let offset = 0;

  console.log(
    `sync: ${source} → ${target} | cohort: has_website=false, rating>=${minRating}, reviews ${minRev}–${maxRev}` +
      (hardCap ? ` | cap ${hardCap}` : ""),
  );

  for (;;) {
    if (hardCap != null && totalUpserted >= hardCap) break;

    const rangeEnd = offset + pageSize - 1;
    let q = supabase
      .from(source)
      .select(selectList)
      .eq("has_website", false)
      .gte("reviews", minRev)
      .lte("reviews", maxRev)
      .gte("rating", minRating)
      .order("place_id", { ascending: true })
      .range(offset, rangeEnd);

    const { data: rows, error } = await q;
    if (error) {
      throw new Error(
        `${error.message}\n` +
          `If a column is missing on ${source}, set SYNC_SOURCE_SELECT to a comma-separated list of columns that exist.`,
      );
    }
    if (!rows?.length) break;

    let batch = stampRows(rows);
    if (hardCap != null) {
      const room = hardCap - totalUpserted;
      if (batch.length > room) batch = batch.slice(0, room);
    }

    const { error: upErr } = await supabase
      .from(target)
      .upsert(batch, { onConflict: "place_id" });
    if (upErr) throw new Error(upErr.message);

    totalUpserted += batch.length;
    console.log(`sync: upserted ${batch.length} (total ${totalUpserted})`);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`sync: done. ${totalUpserted} row(s) upserted into ${target}.`);
  console.log(
    "Next: enrich demo SEO fields — npm run backfill-demo-seo-dispatch-nowebsite",
  );
  console.log(
    "Then: npm run poller-nowebsite (until tasks complete) && npm run pipeline-nowebsite-crm-cohort",
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
