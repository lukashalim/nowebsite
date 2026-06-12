/**
 * Backfill businesses_nowebsite.directory_category_slug from main_category + business_type.
 *
 * Run: npx tsx scripts/backfill-directory-category-slug.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { directoryCategorySlugForRow } from "../src/lib/directory/resolve-category-slug";

config({ path: resolve(process.cwd(), ".env.local") });

const BATCH = 500;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let updated = 0;
  let skipped = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("businesses_nowebsite")
      .select("place_id, main_category, business_type, directory_category_slug")
      .is("directory_category_slug", null)
      .order("place_id", { ascending: true })
      .range(0, BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    if (rows.length === 0) break;

    const updates: { place_id: string; directory_category_slug: string }[] = [];
    for (const row of rows) {
      const slug = directoryCategorySlugForRow(
        row.main_category as string | null,
        row.business_type as string | null,
      );
      if (!slug) {
        skipped += 1;
        continue;
      }
      updates.push({ place_id: row.place_id as string, directory_category_slug: slug });
    }

    if (updates.length > 0) {
      const { error: upErr } = await supabase
        .from("businesses_nowebsite")
        .upsert(updates, { onConflict: "place_id" });
      if (upErr) {
        throw new Error(upErr.message);
      }
      updated += updates.length;
    }

    console.log(
      `backfill: batch ${rows.length}, updated ${updated}, skipped ${skipped}`,
    );

    if (rows.length < BATCH) break;
  }

  console.log(`backfill: done. ${updated} row(s) updated, ${skipped} unresolved.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
