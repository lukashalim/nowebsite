/**
 * Classify canonical category slugs into high-level groups via DeepSeek.
 * Output is for review; apply via scrape/sql/create-category-group-taxonomy.sql
 * or insert into category_groups / category_group_members in Supabase.
 *
 * Run: npx tsx scripts/generate-category-group-mapping.ts
 *      npx tsx scripts/generate-category-group-mapping.ts --include-db
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_MERGE_GROUPS } from "../src/lib/directory/category-merge";
import { CATEGORY_PRIORITY } from "../src/lib/directory/category-priority";
import {
  CATEGORY_GROUP_IDS,
  type CategoryGroupId,
} from "../src/lib/directory/category-groups";
import { deepseekChat } from "../src/lib/deepseek";

config({ path: resolve(process.cwd(), ".env.local") });

const GROUP_DEFINITIONS = `
1. home-services — A professional comes TO the customer's home or property (plumber, electrician, roofer, HVAC, landscaper, handyman, mobile mechanic). NOT laundromat, dry-cleaner, or shop-based auto repair.
2. food-hospitality — Restaurants, bars, grocery stores, convenience stores.
3. professional — Accountants, real estate agents, tax preparation, office professional services.
4. health-wellness — Chiropractors, dentists, spas, salons, barbers, nail salons, personal care.
5. other — Customer visits the business (laundromat, dry-cleaner, shop auto-repair), or anything that does not fit above. Generic auto-repair = other; mobile-mechanic slugs = home-services.
`.trim();

interface SlugCandidate {
  slug: string;
}

function collectStaticSlugs(): SlugCandidate[] {
  const slugs = new Set<string>();
  for (const slug of CATEGORY_PRIORITY) {
    slugs.add(slug.toLowerCase());
  }
  for (const group of CATEGORY_MERGE_GROUPS) {
    slugs.add(group.primarySlug.toLowerCase());
    for (const secondary of group.secondarySlugs) {
      slugs.add(secondary.toLowerCase());
    }
  }
  return [...slugs].sort().map((slug) => ({ slug }));
}

async function collectDbSlugs(): Promise<SlugCandidate[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("Skipping DB slugs: missing Supabase credentials");
    return [];
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("businesses_nowebsite")
    .select("directory_category_slug")
    .not("directory_category_slug", "is", null);

  if (error) {
    console.warn("Skipping DB slugs:", error.message);
    return [];
  }

  const slugs = new Set<string>();
  for (const row of data ?? []) {
    const slug = row.directory_category_slug;
    if (typeof slug === "string" && slug.trim()) {
      slugs.add(slug.trim().toLowerCase());
    }
  }
  return [...slugs].sort().map((slug) => ({ slug }));
}

function validateMappings(
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

async function main() {
  const includeDb = process.argv.includes("--include-db");
  const staticSlugs = collectStaticSlugs();
  const dbSlugs = includeDb ? await collectDbSlugs() : [];

  const bySlug = new Map<string, SlugCandidate>();
  for (const c of [...staticSlugs, ...dbSlugs]) {
    bySlug.set(c.slug, c);
  }
  const candidates = [...bySlug.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );

  console.log(`Classifying ${candidates.length} slugs via DeepSeek…`);

  const raw = await deepseekChat(
    [
      {
        role: "system",
        content: `You classify local business category URL slugs into exactly one high-level group.

Groups:
${GROUP_DEFINITIONS}

Respond with JSON: { "mappings": { "<slug>": "<group-id>", ... } }
Valid group ids: ${CATEGORY_GROUP_IDS.join(", ")}`,
      },
      {
        role: "user",
        content: JSON.stringify({ slugs: candidates.map((c) => c.slug) }),
      },
    ],
    { jsonObject: true, temperature: 0.1, maxTokens: 4096 },
  );

  const parsed = JSON.parse(raw) as { mappings?: Record<string, string> };
  if (!parsed.mappings) {
    throw new Error("DeepSeek response missing mappings object");
  }

  const mappings = validateMappings(candidates, parsed.mappings);

  const byGroup = new Map<CategoryGroupId, string[]>();
  for (const id of CATEGORY_GROUP_IDS) {
    byGroup.set(id, []);
  }
  for (const [slug, groupId] of Object.entries(mappings)) {
    byGroup.get(groupId)?.push(slug);
  }

  console.log(JSON.stringify(Object.fromEntries(byGroup), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
