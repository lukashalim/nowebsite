/**
 * Enrich Maryland home-improvement contractors (no website) with MHIC license data.
 *
 *   npm run enrich-md-mhic
 *   npm run enrich-md-mhic -- --dry-run --limit 20
 *   npm run enrich-md-mhic -- --force --limit 50
 *
 * Env: APIFY_TOKEN or APIFY_API_KEY (.env or .env.local). Never commit it.
 * Optional: MHIC_SLEEP_MS (default 500), MHIC_BACKFILL_BATCH (default 50).
 *
 * Prerequisite: run scrape/sql/add-mhic-license.sql in the Supabase SQL editor.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import {
  createMhicSearcher,
  loadDotEnvIfMissing,
  resolveApifyToken,
} from "./lib/apify-mhic.mjs";
import {
  MHIC_CONTRACTOR_SLUGS,
  businessNameQuery,
  mhicRowPatch,
  ownerLastName,
  pickConfidentMhicMatch,
  zip5,
} from "./lib/mhic-match.mjs";
import { sleep } from "./lib/telnyx-phone-lookup.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const CONTACTS_TABLE = "crm_user_contacts";
const DEFAULT_LIMIT = 200;
const MD_STATES = ["Maryland", "MD"];
const CSV_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "md_contractors_no_website_mhic.csv",
);

const BATCH = Math.max(
  10,
  Number.parseInt(process.env.MHIC_BACKFILL_BATCH ?? "50", 10) || 50,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.MHIC_SLEEP_MS ?? "500", 10) || 500,
);

const BASE_SELECT =
  "place_id, name, address, city, state, postal_code, directory_category_slug, main_category, business_type, phone, google_maps_link";
const SELECT_WITH_ANGI = `${BASE_SELECT}, angi_owner_name`;

const CSV_COLUMNS = [
  "place_id",
  "name",
  "city",
  "state",
  "postal_code",
  "directory_category_slug",
  "main_category",
  "phone",
  "google_maps_link",
  "mhic_match",
  "mhic_license_number",
  "mhic_suffix",
  "mhic_legal_name",
  "mhic_trade_name",
  "mhic_category",
  "mhic_expiration_date",
  "mhic_address",
  "mhic_city",
  "mhic_state",
  "mhic_zip",
];

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_LIMIT;
}

function escapeCsvField(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsvField(row[col])).join(","),
  );
  return [header, ...body].join("\r\n") + "\r\n";
}

function csvRow(business, patch) {
  return {
    place_id: business.place_id,
    name: business.name,
    city: business.city,
    state: business.state,
    postal_code: business.postal_code,
    directory_category_slug: business.directory_category_slug,
    main_category: business.main_category,
    phone: business.phone,
    google_maps_link: business.google_maps_link,
    mhic_match: patch?.mhic_match ?? "",
    mhic_license_number: patch?.mhic_license_number ?? "",
    mhic_suffix: patch?.mhic_suffix ?? "",
    mhic_legal_name: patch?.mhic_legal_name ?? "",
    mhic_trade_name: patch?.mhic_trade_name ?? "",
    mhic_category: patch?.mhic_category ?? "",
    mhic_expiration_date: patch?.mhic_expiration_date ?? "",
    mhic_address: patch?.mhic_address ?? "",
    mhic_city: patch?.mhic_city ?? "",
    mhic_state: patch?.mhic_state ?? "",
    mhic_zip: patch?.mhic_zip ?? "",
  };
}

function writeCsv(rows) {
  mkdirSync(dirname(CSV_PATH), { recursive: true });
  writeFileSync(CSV_PATH, toCsv(rows), "utf8");
}

async function fetchCandidates(supabase, { cap, force, includeAngiOwner }) {
  const select = includeAngiOwner ? SELECT_WITH_ANGI : BASE_SELECT;
  const out = [];
  let offset = 0;

  while (out.length < cap) {
    const take = Math.min(BATCH, cap - out.length);
    let q = supabase
      .from(TABLE)
      .select(select)
      .eq("is_invalid", false)
      .eq("has_website", false)
      .in("state", MD_STATES)
      .in("directory_category_slug", MHIC_CONTRACTOR_SLUGS)
      .order("place_id", { ascending: true })
      .range(offset, offset + take - 1);

    if (!force) {
      q = q.is("mhic_checked_at", null);
    }

    const { data, error } = await q;
    if (error) return { rows: out, error };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < take) break;
    offset += rows.length;
  }

  return { rows: out.slice(0, cap), error: null };
}

async function fetchOwnerNames(supabase, placeIds) {
  const map = new Map();
  if (placeIds.length === 0) return map;

  for (let i = 0; i < placeIds.length; i += 200) {
    const chunk = placeIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from(CONTACTS_TABLE)
      .select("place_id, owner_name")
      .in("place_id", chunk)
      .not("owner_name", "is", null);

    if (error) {
      console.warn(`crm_user_contacts owner lookup: ${error.message}`);
      break;
    }
    for (const row of data ?? []) {
      const name = row.owner_name?.trim();
      if (!name || map.has(row.place_id)) continue;
      map.set(row.place_id, name);
    }
  }
  return map;
}

function ownerNameFor(row, contactOwners) {
  const angi =
    typeof row.angi_owner_name === "string" ? row.angi_owner_name.trim() : "";
  if (angi) return angi;
  return contactOwners.get(row.place_id) ?? "";
}

async function searchWithDelay(searcher, input) {
  const before = searcher.stats().actorCalls;
  const items = await searcher.search(input);
  if (SLEEP_MS > 0 && searcher.stats().actorCalls > before) {
    await sleep(SLEEP_MS);
  }
  return items;
}

async function lookupMhic(searcher, row, ownerName) {
  const city = row.city?.trim() || "";
  const query = businessNameQuery(row.name);
  const lastName = ownerLastName(ownerName);
  const zip = zip5(row.postal_code);
  const matchCtx = {
    businessName: row.name,
    ownerName,
    city: row.city,
    postalCode: row.postal_code,
  };

  if (query && city) {
    const hits = await searchWithDelay(searcher, {
      searchType: "businessName",
      query,
      city,
      maxResults: 25,
    });
    const match = pickConfidentMhicMatch(hits, matchCtx);
    if (match) return { match, error: null };
  }

  if (lastName && city) {
    const hits = await searchWithDelay(searcher, {
      searchType: "personalName",
      query: lastName,
      city,
      maxResults: 25,
    });
    const match = pickConfidentMhicMatch(hits, matchCtx);
    if (match) return { match, error: null };
  }

  if (zip) {
    const hits = await searchWithDelay(searcher, {
      searchType: "location",
      zip,
      maxResults: 50,
    });
    const match = pickConfidentMhicMatch(hits, matchCtx);
    if (match) return { match, error: null };
  }

  return { match: null, error: null };
}

async function main() {
  loadEnvLocal();
  loadDotEnvIfMissing();

  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const cap = parseLimit(process.argv);

  const token = resolveApifyToken();
  if (!token && !dryRun) {
    throw new Error(
      "APIFY_TOKEN (or APIFY_API_KEY) is required in .env or .env.local",
    );
  }

  const supabase = getSupabase();
  let includeAngiOwner = true;
  let fetched = await fetchCandidates(supabase, { cap, force, includeAngiOwner });
  if (fetched.error && /angi_owner_name|schema cache/i.test(fetched.error.message)) {
    includeAngiOwner = false;
    console.warn("angi_owner_name missing; continuing without it");
    fetched = await fetchCandidates(supabase, { cap, force, includeAngiOwner });
  }
  if (fetched.error) {
    const hint = /mhic_checked_at|schema cache/i.test(fetched.error.message)
      ? " Run scrape/sql/add-mhic-license.sql in the Supabase SQL editor, then retry."
      : "";
    throw new Error(fetched.error.message + hint);
  }

  const candidates = fetched.rows;
  const contactOwners = await fetchOwnerNames(
    supabase,
    candidates.map((r) => r.place_id),
  );

  const searcher = dryRun ? null : createMhicSearcher(token);
  const csvRows = [];
  let matches = 0;
  let unmatched = 0;
  let errors = 0;

  for (const row of candidates) {
    const ownerName = ownerNameFor(row, contactOwners);

    if (dryRun) {
      csvRows.push(csvRow(row, null));
      console.log(
        JSON.stringify({
          place_id: row.place_id,
          name: row.name,
          city: row.city,
          zip: zip5(row.postal_code),
          query: businessNameQuery(row.name),
          ownerLastName: ownerLastName(ownerName) || null,
          dryRun: true,
        }),
      );
      continue;
    }

    let result;
    try {
      result = await lookupMhic(searcher, row, ownerName);
    } catch (err) {
      errors += 1;
      console.error(
        JSON.stringify({
          place_id: row.place_id,
          name: row.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      csvRows.push(csvRow(row, null));
      continue;
    }

    const patch = mhicRowPatch(result.match, { matched: Boolean(result.match) });
    const { error: upErr } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("place_id", row.place_id);

    if (upErr) {
      errors += 1;
      console.error(`Update failed ${row.place_id}:`, upErr.message);
      csvRows.push(csvRow(row, null));
      continue;
    }

    if (patch.mhic_match) {
      matches += 1;
    } else {
      unmatched += 1;
    }

    csvRows.push(csvRow(row, patch));
    console.log(
      JSON.stringify({
        place_id: row.place_id,
        name: row.name,
        mhic_match: patch.mhic_match,
        mhic_license_number: patch.mhic_license_number,
        mhic_trade_name: patch.mhic_trade_name,
      }),
    );
  }

  writeCsv(csvRows);
  const { actorCalls, cacheHits } = searcher?.stats() ?? {
    actorCalls: 0,
    cacheHits: 0,
  };

  console.log(
    `enrich-md-mhic: candidates=${candidates.length} actorCalls=${actorCalls} cacheHits=${cacheHits} matches=${matches} unmatched=${unmatched} errors=${errors}${dryRun ? " (dry-run)" : ""}`,
  );
  console.log(`csv: ${CSV_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
