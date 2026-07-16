/**
 * Backfill phone_line_type on home-services businesses via Telnyx Number Lookup.
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/backfill-phone-line-type.mjs
 *   node ./scrape/backfill-phone-line-type.mjs --dry-run --limit 100
 *   node ./scrape/backfill-phone-line-type.mjs --force --limit 50
 *   node ./scrape/backfill-phone-line-type.mjs --states=Maryland,"District Of Columbia"
 *
 * Env: TELNYX_API_KEY or telnyx_api_key (required), Supabase via loadEnvLocal().
 * Optional: PHONE_LINE_BACKFILL_BATCH (default 25), PHONE_LINE_BACKFILL_SLEEP_MS (default 300),
 *   PHONE_LINE_BACKFILL_STATES (comma-separated state names, e.g. Maryland,District Of Columbia).
 */

import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";
import { fetchHomeServicesSlugs } from "./lib/fetch-home-services-slugs.mjs";
import {
  lookupTelnyxPhoneLineType,
  normalizePhoneE164,
  resolveTelnyxApiKey,
  sleep,
} from "./lib/telnyx-phone-lookup.mjs";

const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const BATCH = Math.max(
  10,
  Number.parseInt(process.env.PHONE_LINE_BACKFILL_BATCH ?? "25", 10) || 25,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.PHONE_LINE_BACKFILL_SLEEP_MS ?? "300", 10) || 300,
);

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Map common aliases to exact businesses_nowebsite.state values. */
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
  const env = process.env.PHONE_LINE_BACKFILL_STATES?.trim();
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

function resolveCountry(raw) {
  if (raw === "US" || raw === "GB" || raw === "AU") return raw;
  return "US";
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const cap = parseLimit(process.argv);

  const apiKey = resolveTelnyxApiKey();
  if (!apiKey && !dryRun) {
    throw new Error(
      "TELNYX_API_KEY (or telnyx_api_key) is required in .env.local",
    );
  }

  if (apiKey && !dryRun) {
    const probe = await lookupTelnyxPhoneLineType("+12025551234", apiKey);
    if (!probe.ok) {
      throw new Error(
        `Telnyx lookup unavailable (HTTP ${probe.httpStatus}): ${probe.errorDetail}. ` +
          "Enable Number Lookup on your Telnyx account: https://telnyx.com/products/number-lookup",
      );
    }
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
      .select("place_id, name, phone, country, phone_line_type, state")
      .eq("is_invalid", false)
      .in("directory_category_slug", homeServicesSlugs)
      .not("phone", "is", null)
      .order("place_id", { ascending: true })
      .range(rangeStart, rangeStart + BATCH - 1);

    if (stateFilter?.length) {
      q = q.in("state", stateFilter);
    }

    if (!force) {
      q = q.is("phone_line_type", null);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []).filter((row) => row.phone?.trim());
    if (rows.length === 0) break;

    for (const row of rows) {
      if (cap != null && scanned >= cap) break;
      scanned += 1;

      const country = resolveCountry(row.country);
      const e164 = normalizePhoneE164(row.phone, country);
      if (!e164) {
        skipped += 1;
        console.warn(`Skip invalid phone ${row.place_id}: ${row.phone}`);
        continue;
      }

      let classification = "unknown";
      let checkedAt = new Date().toISOString();
      let rawType = null;

      if (dryRun) {
        console.log(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            phone: row.phone,
            e164,
            dryRun: true,
          }),
        );
        updated += 1;
        continue;
      }

      const lookup = await lookupTelnyxPhoneLineType(e164, apiKey);
      if (!lookup.ok) {
        skipped += 1;
        console.error(
          JSON.stringify({
            place_id: row.place_id,
            name: row.name,
            e164,
            error: lookup.errorDetail,
            httpStatus: lookup.httpStatus,
          }),
        );
        if (lookup.httpStatus === 429) {
          console.warn("Rate limited (429); sleeping 5s...");
          await sleep(5000);
        }
        continue;
      }

      classification = lookup.classification;
      checkedAt = lookup.checkedAt;
      rawType = lookup.rawType;

      const { error: upErr } = await supabase
        .from(TABLE)
        .update({
          phone_line_type: classification,
          phone_line_type_checked_at: checkedAt,
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
          e164,
          classification,
          rawType,
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

  console.log(
    `backfill-phone-line-type: scanned=${scanned} updated=${updated} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
