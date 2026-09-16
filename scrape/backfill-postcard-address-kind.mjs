/**
 * Score existing Maps streets with Lob USAV (residential vs commercial / CMRA / PO Box).
 *
 *   npm run postcard:score-addresses
 *   npm run postcard:score-addresses -- --dry-run --limit 20
 *   npm run postcard:score-addresses -- --force --limit 50
 *
 * Env: LOB_LIVE_SECRET_KEY (or LOB_SECRET_KEY / LOB_API_KEY) must be a live_ secret.
 * Do not use LOB_LIVE_PUBLISHABLE_KEY or LOB_PUBLISHABLE_KEY — they cannot score real addresses.
 * Optional: POSTCARD_ADDRESS_BACKFILL_BATCH (default 25), POSTCARD_ADDRESS_SLEEP_MS (default 300).
 *
 * Prerequisite: run scrape/sql/add-postcard-address-kind.sql in the Supabase SQL editor.
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import { isLobLiveMode, verifyUsAddress } from "../src/lib/lob.ts";
import { isMailableLeadAddress } from "../src/lib/postcard/address.ts";
import {
  classifyPostcardAddressKind,
  countOccupancyPeers,
  isCmraVerification,
  occupancyKey,
  postcardAddressKindPatch,
} from "../src/lib/postcard/address-kind.ts";
import { sleep } from "./lib/telnyx-phone-lookup.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const DEFAULT_LIMIT = 200;
const BATCH = Math.max(
  10,
  Number.parseInt(process.env.POSTCARD_ADDRESS_BACKFILL_BATCH ?? "25", 10) ||
    25,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.POSTCARD_ADDRESS_SLEEP_MS ?? "300", 10) || 300,
);

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_LIMIT;
}

function resolveLiveLobKey() {
  const candidates = [
    process.env.LOB_LIVE_SECRET_KEY,
    process.env.LOB_SECRET_KEY,
    process.env.LOB_API_KEY,
    process.env.lob_api_key,
  ];
  for (const raw of candidates) {
    const key = raw?.trim();
    if (!key) continue;
    // Publishable keys (live_pub_ / test_pub_) cannot call USAV.
    if (key.startsWith("live_pub") || key.startsWith("test_pub")) continue;
    return key;
  }
  return null;
}

function zip5(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

async function loadPeerRows(supabase, zipPrefixes) {
  const out = [];
  const seen = new Set();
  for (const zip of zipPrefixes) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("place_id, address, postal_code")
      .eq("is_invalid", false)
      .like("postal_code", `${zip}%`)
      .limit(2000);
    if (error) {
      console.warn(`peer lookup ${zip}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      if (!row.place_id || seen.has(row.place_id)) continue;
      seen.add(row.place_id);
      out.push(row);
    }
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const cap = parseLimit(process.argv);

  const apiKey = resolveLiveLobKey();
  if (!dryRun) {
    if (!apiKey) {
      throw new Error(
        "LOB_SECRET_KEY (or LOB_API_KEY) is required in .env.local. Use the live secret key (live_…), not LOB_PUBLISHABLE_KEY.",
      );
    }
    if (!isLobLiveMode(apiKey)) {
      throw new Error(
        "LOB_SECRET_KEY must be a live_ secret key (test keys cannot score real US addresses)",
      );
    }
  }

  const supabase = getSupabase();
  const candidates = [];
  let offset = 0;

  while (candidates.length < cap) {
    const take = BATCH;
    let q = supabase
      .from(TABLE)
      .select(
        "place_id, name, address, city, state, postal_code, country, postcard_address_kind",
      )
      .eq("is_invalid", false)
      .eq("has_website", false)
      .or("country.eq.US,country.is.null")
      .not("address", "is", null)
      .not("city", "is", null)
      .not("state", "is", null)
      .not("postal_code", "is", null)
      .order("place_id", { ascending: true })
      .range(offset, offset + take - 1);

    if (!force) {
      q = q.is("postcard_address_checked_at", null);
    }

    const { data, error } = await q;
    if (error) {
      const hint = /postcard_address_checked_at|schema cache/i.test(
        error.message,
      )
        ? " Run scrape/sql/add-postcard-address-kind.sql in the Supabase SQL editor, then retry."
        : "";
      throw new Error(error.message + hint);
    }
    const page = data ?? [];
    if (page.length === 0) break;
    for (const row of page) {
      if (candidates.length >= cap) break;
      if (
        !isMailableLeadAddress({
          address: row.address,
          city: row.city,
          state: row.state,
          postal_code: row.postal_code,
        })
      ) {
        continue;
      }
      candidates.push(row);
    }
    offset += page.length;
    if (page.length < take) break;
  }

  const batch = candidates.slice(0, cap);
  const zipPrefixes = [
    ...new Set(batch.map((r) => zip5(r.postal_code)).filter(Boolean)),
  ];
  const peerRows = dryRun ? [] : await loadPeerRows(supabase, zipPrefixes);

  let scored = 0;
  let skipped = 0;
  let errors = 0;
  const counts = {
    residential: 0,
    po_box: 0,
    commercial: 0,
    cmra: 0,
    shared: 0,
    undeliverable: 0,
    unknown: 0,
  };

  for (const row of batch) {
    const key = occupancyKey(row.address, row.postal_code);
    const peerCount = countOccupancyPeers(peerRows, key, row.place_id);

    if (dryRun) {
      console.log(
        JSON.stringify({
          place_id: row.place_id,
          name: row.name,
          city: row.city,
          zip: zip5(row.postal_code),
          occupancyKey: key,
          dryRun: true,
        }),
      );
      scored += 1;
      continue;
    }

    let verified;
    try {
      verified = await verifyUsAddress(apiKey, {
        primary_line: row.address.trim(),
        city: row.city.trim(),
        state: row.state.trim(),
        zip_code: row.postal_code.trim(),
      });
    } catch (err) {
      errors += 1;
      console.error(
        JSON.stringify({
          place_id: row.place_id,
          name: row.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      skipped += 1;
      if (SLEEP_MS > 0) await sleep(SLEEP_MS);
      continue;
    }

    const isCmra = isCmraVerification({
      dpvCmra: verified.dpv_cmra,
      pmbDesignator: verified.pmb_designator,
      pmbNumber: verified.pmb_number,
    });
    const kind = classifyPostcardAddressKind({
      deliverability: verified.deliverability,
      addressType: verified.address_type,
      recordType: verified.record_type,
      dpvCmra: verified.dpv_cmra,
      pmbDesignator: verified.pmb_designator,
      pmbNumber: verified.pmb_number,
      peerCount,
    });
    const patch = postcardAddressKindPatch({
      kind,
      recordType: verified.record_type,
      isCmra,
      peerCount,
    });

    const { error: upErr } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("place_id", row.place_id);

    if (upErr) {
      errors += 1;
      console.error(`Update failed ${row.place_id}:`, upErr.message);
      skipped += 1;
      if (SLEEP_MS > 0) await sleep(SLEEP_MS);
      continue;
    }

    counts[kind] += 1;
    scored += 1;
    console.log(
      JSON.stringify({
        place_id: row.place_id,
        name: row.name,
        kind,
        record_type: verified.record_type,
        address_type: verified.address_type,
        peerCount,
        deliverability: verified.deliverability,
      }),
    );

    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }

  console.log(
    `postcard:score-addresses: candidates=${batch.length} scored=${scored} skipped=${skipped} errors=${errors}${dryRun ? " (dry-run)" : ""}`,
  );
  if (!dryRun) {
    console.log(
      `kinds: residential=${counts.residential} po_box=${counts.po_box} commercial=${counts.commercial} cmra=${counts.cmra} shared=${counts.shared} undeliverable=${counts.undeliverable} unknown=${counts.unknown}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
