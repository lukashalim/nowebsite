/**
 * Classify every distinct directory category slug in Supabase via DeepSeek,
 * then upsert category_group_members (and ensure category_groups exist).
 *
 * Run: npx tsx scripts/sync-category-group-members-from-db.ts
 *      npx tsx scripts/sync-category-group-members-from-db.ts --dry-run
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_GROUP_IDS,
  FALLBACK_CATEGORY_GROUPS,
  type CategoryGroupId,
} from "../src/lib/directory/category-groups";
import { canonicalCategorySlug } from "../src/lib/directory/category-merge";
import { directoryCategorySlugForRow } from "../src/lib/directory/resolve-category-slug";
import { deepseekChat } from "../src/lib/deepseek";

config({ path: resolve(process.cwd(), ".env.local") });

const BATCH_ROWS = 1000;
const CLASSIFY_CHUNK = 50;

const GROUP_DEFINITIONS = `
1. home-services — ANY business where a service provider comes TO the customer's home or property (on-site / mobile service at the customer's location). Includes trades and home maintenance such as: plumbing, electrical, HVAC, landscaping, roofing, handyman, mobile mechanics, concrete work, power washing, mobile car detailing, chimney cleaning, carpet cleaning, home repair, dryer vent cleaning, appliance repair, pest control, tree service, garage door repair, fencing, pool service, and similar on-site work. NOT businesses where the customer must visit a shop or storefront.

2. food-hospitality — Restaurants, bars, cafes, catering, grocery stores, convenience stores, bakeries, food trucks with a fixed hospitality focus.

3. professional — Accountants, real estate agents/brokers, tax preparation, lawyers, insurance agents, financial advisors, and similar office-based professional services.

4. health-wellness — Chiropractors, dentists, doctors/clinics, spas, massage, salons, barbers, nail salons, gyms, yoga, mental health, personal care and body wellness.

5. other — Customer visits the business location (laundromat, dry cleaner, shop-based auto repair, retail stores, shopping malls, pet stores without mobile grooming), or anything that clearly does not fit above. Shop-based auto repair = other; mobile car detailing / mobile mechanic = home-services.
`.trim();

interface SlugCandidate {
  slug: string;
  sampleLabel: string | null;
  listingCount: number;
}

function createSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function collectSlugCandidates(
  supabase: SupabaseClient,
): Promise<SlugCandidate[]> {
  const bySlug = new Map<string, SlugCandidate>();
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("businesses_nowebsite")
      .select("directory_category_slug, main_category, business_type")
      .eq("is_invalid", false)
      .range(offset, offset + BATCH_ROWS - 1);

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      let slug =
        typeof row.directory_category_slug === "string"
          ? row.directory_category_slug.trim().toLowerCase()
          : "";
      if (!slug) {
        slug =
          directoryCategorySlugForRow(
            row.main_category as string | null,
            row.business_type as string | null,
          ) ?? "";
      }
      if (!slug) continue;

      slug = canonicalCategorySlug(slug);
      const label =
        typeof row.main_category === "string" && row.main_category.trim()
          ? row.main_category.trim()
          : null;

      const existing = bySlug.get(slug);
      if (existing) {
        existing.listingCount += 1;
        if (!existing.sampleLabel && label) {
          existing.sampleLabel = label;
        }
      } else {
        bySlug.set(slug, {
          slug,
          sampleLabel: label,
          listingCount: 1,
        });
      }
    }

    console.log(`Scanned ${offset + rows.length} listing rows…`);
    if (rows.length < BATCH_ROWS) break;
    offset += BATCH_ROWS;
  }

  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function validateChunkMappings(
  candidates: SlugCandidate[],
  mappings: Record<string, string>,
): Record<string, CategoryGroupId> {
  const valid = new Set<string>(CATEGORY_GROUP_IDS);
  const out: Record<string, CategoryGroupId> = {};

  for (const { slug } of candidates) {
    const group = mappings[slug];
    if (!group || !valid.has(group)) {
      throw new Error(`Missing or invalid group for slug "${slug}": ${group}`);
    }
    out[slug] = group as CategoryGroupId;
  }

  return out;
}

async function classifyChunk(
  candidates: SlugCandidate[],
): Promise<Record<string, CategoryGroupId>> {
  const payload = candidates.map((c) => ({
    slug: c.slug,
    sample_label: c.sampleLabel,
    listing_count: c.listingCount,
  }));

  const raw = await deepseekChat(
    [
      {
        role: "system",
        content: `You classify local business directory category slugs into exactly one high-level industry group.

Groups:
${GROUP_DEFINITIONS}

Rules:
- Each slug must map to exactly one group id.
- Prefer on-site/mobile-to-customer for home-services when the slug suggests the provider travels to the customer.
- Use sample_label as extra context when the slug alone is ambiguous.

Respond with JSON only: { "mappings": { "<slug>": "<group-id>", ... } }
Valid group ids: ${CATEGORY_GROUP_IDS.join(", ")}`,
      },
      {
        role: "user",
        content: JSON.stringify({ categories: payload }),
      },
    ],
    { jsonObject: true, temperature: 0.1, maxTokens: 8192 },
  );

  const parsed = JSON.parse(raw) as { mappings?: Record<string, string> };
  if (!parsed.mappings) {
    throw new Error("DeepSeek response missing mappings object");
  }
  return validateChunkMappings(candidates, parsed.mappings);
}

async function classifyAll(
  candidates: SlugCandidate[],
): Promise<Record<string, CategoryGroupId>> {
  const merged: Record<string, CategoryGroupId> = {};

  for (let i = 0; i < candidates.length; i += CLASSIFY_CHUNK) {
    const chunk = candidates.slice(i, i + CLASSIFY_CHUNK);
    console.log(
      `DeepSeek classifying slugs ${i + 1}-${i + chunk.length} of ${candidates.length}…`,
    );
    const chunkMappings = await classifyChunk(chunk);
    Object.assign(merged, chunkMappings);
  }

  return merged;
}

async function ensureCategoryGroups(supabase: SupabaseClient): Promise<void> {
  const rows = FALLBACK_CATEGORY_GROUPS.map((g, index) => ({
    id: g.id,
    label: g.label,
    description:
      g.id === "home-services"
        ? "Any business where a service provider comes to the customer's home or property — plumbing, roofing, power washing, mobile car detailing, carpet cleaning, appliance repair, concrete work, chimney cleaning, and similar on-site trades."
        : g.description,
    display_order: index + 1,
  }));

  const { error } = await supabase.from("category_groups").upsert(rows, {
    onConflict: "id",
  });
  if (error) throw new Error(`category_groups upsert: ${error.message}`);
}

async function upsertMembers(
  supabase: SupabaseClient,
  mappings: Record<string, CategoryGroupId>,
): Promise<number> {
  const rows = Object.entries(mappings).map(([category_slug, group_id]) => ({
    category_slug,
    group_id,
  }));

  const { error } = await supabase
    .from("category_group_members")
    .upsert(rows, { onConflict: "category_slug" });

  if (error) throw new Error(`category_group_members upsert: ${error.message}`);
  return rows.length;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createSupabase();

  console.log("Collecting distinct category slugs from businesses_nowebsite…");
  const candidates = await collectSlugCandidates(supabase);
  console.log(`Found ${candidates.length} distinct category slug(s).`);

  if (candidates.length === 0) {
    console.log("Nothing to classify.");
    return;
  }

  const mappings = await classifyAll(candidates);

  const byGroup = new Map<CategoryGroupId, string[]>();
  for (const id of CATEGORY_GROUP_IDS) {
    byGroup.set(id, []);
  }
  for (const [slug, groupId] of Object.entries(mappings)) {
    byGroup.get(groupId)?.push(slug);
  }

  console.log("\nClassification summary:");
  for (const [groupId, slugs] of byGroup) {
    console.log(`  ${groupId}: ${slugs.length} slug(s)`);
  }

  if (dryRun) {
    console.log("\n--dry-run: skipping Supabase writes.");
    console.log(JSON.stringify(Object.fromEntries(byGroup), null, 2));
    return;
  }

  console.log("\nUpserting category_groups…");
  await ensureCategoryGroups(supabase);

  console.log("Upserting category_group_members…");
  const count = await upsertMembers(supabase, mappings);
  console.log(`Done. Upserted ${count} category_group_members row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
