#!/usr/bin/env node
/**
 * Apply category slug merges to businesses_nowebsite via Supabase admin API.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local).
 *
 *   node scrape/scripts/merge-category-slugs.mjs
 *   node scrape/scripts/merge-category-slugs.mjs --dry-run
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_MERGE_GROUPS } from "../lib/category-merge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "../../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^([^#=]+)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.BUSINESSES_TABLE?.trim() || "businesses_nowebsite";

if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countEq(column, legacy) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, legacy);
  if (error) throw error;
  return count ?? 0;
}

async function applyUpdate(column, legacy, canonical) {
  const patch = {
    [column]: canonical,
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    const n = await countEq(column, legacy);
    if (n > 0) console.log(`[dry-run] ${column}=${legacy} → ${canonical}: ${n}`);
    return n;
  }

  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq(column, legacy)
    .select("id");

  if (error) throw error;
  const n = data?.length ?? 0;
  if (n > 0) console.log(`${column} ${legacy} → ${canonical}: ${n}`);
  return n;
}

async function main() {
  let total = 0;
  for (const group of CATEGORY_MERGE_GROUPS) {
    for (const legacy of group.legacyBusinessTypes) {
      if (legacy === group.canonicalBusinessType) continue;
      total += await applyUpdate("business_type", legacy, group.canonicalBusinessType);
      total += await applyUpdate("main_category", legacy, group.canonicalBusinessType);
    }
  }
  console.log(
    dryRun
      ? `Dry run complete (${total} rows would be touched).`
      : `Updated ${total} row(s). Deploy app code so /hair-salon etc. redirect to primaries.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
