/**
 * Re-check leads that were previously flagged Angi Approved (old logic).
 * Usage: node --import ./scrape/env-nowebsite-queue.mjs --import tsx ./scrape/recheck-angi-approved.mjs
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import {
  detectAngiListingForBusiness,
  resolveDataForSeoCredentials,
} from "../src/lib/angi-listing.ts";
import { closeAngiProfileBrowser } from "../src/lib/angi-profile-scrape.ts";

loadEnvLocal();
const supabase = getSupabase();
const credentials = resolveDataForSeoCredentials();
if (!credentials) throw new Error("DataForSEO credentials missing");

const { data: approvedRows } = await supabase
  .from("businesses_nowebsite")
  .select(
    "place_id, name, address, city, state, phone, country, main_category, business_type, directory_category_slug, has_angi_listing, angi_competitors",
  )
  .eq("has_angi_listing", true);

const { data: competitorRows } = await supabase
  .from("businesses_nowebsite")
  .select(
    "place_id, name, address, city, state, phone, country, main_category, business_type, directory_category_slug, has_angi_listing, angi_competitors",
  )
  .not("angi_competitors", "is", null);

const byId = new Map();
for (const row of [...(approvedRows ?? []), ...(competitorRows ?? [])]) {
  const comps = row.angi_competitors;
  const hadCompetitors = Array.isArray(comps) && comps.length > 0;
  if (row.has_angi_listing === true || hadCompetitors) {
    byId.set(row.place_id, row);
  }
}

const rows = [...byId.values()];
console.log(`recheck-angi-approved: ${rows.length} historical approved candidates`);

let survived = 0;
let dropped = 0;
let errors = 0;
const results = [];

for (const row of rows) {
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

  const detected = await detectAngiListingForBusiness(input, credentials);

  if (!detected.ok) {
    errors += 1;
    console.error(JSON.stringify({ place_id: row.place_id, name: row.name, error: detected.error }));
    continue;
  }

  const { result } = detected;
  const wasApproved = row.has_angi_listing === true;

  await supabase
    .from("businesses_nowebsite")
    .update({
      has_angi_listing: result.hasListing,
      angi_listing_url: result.url,
      angi_listing_title: result.title,
      angi_listing_confidence: result.confidence,
      angi_competitors: result.hasListing ? result.competitors : [],
      angi_listing_checked_at: result.checkedAt,
      angi_owner_name: result.angiOwnerName ?? null,
    })
    .eq("place_id", row.place_id);

  if (result.hasListing) survived += 1;
  else dropped += 1;

  results.push({
    name: row.name,
    city: row.city,
    state: row.state,
    wasApproved,
    nowApproved: result.hasListing,
    signals: result.scrapeSignals ?? [],
    url: result.url,
  });

  console.log(
    JSON.stringify({
      name: row.name,
      wasApproved,
      nowApproved: result.hasListing,
      signals: result.scrapeSignals ?? [],
    }),
  );
}

await closeAngiProfileBrowser();

console.log("\n--- SUMMARY ---");
console.log(JSON.stringify({ total: rows.length, survived, dropped, errors }, null, 2));
console.log("\nSurvived:");
for (const r of results.filter((x) => x.nowApproved)) {
  console.log(`  - ${r.name} (${r.city}, ${r.state})`);
}
console.log("\nDropped (was approved, now false):");
for (const r of results.filter((x) => x.wasApproved && !x.nowApproved)) {
  console.log(`  - ${r.name} | ${(r.signals ?? []).join(", ")}`);
}
