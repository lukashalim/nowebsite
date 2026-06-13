/**
 * Seed CRM test call lead. Run: npx tsx scripts/seed-crm-test-call-lead.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const PLACE_ID = "ChIJ_TEST_LUKAS_CALL";
const TEST_EMAIL = "lukas.halim@gmail.com";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    place_id: PLACE_ID,
    demo_slug: "test-lukas-call",
    name: "TEST — Lukas Call Lead",
    address: "123 Test Street",
    city: "Bethesda",
    state: "MD",
    country: "US",
    postal_code: "20814",
    main_category: "Plumber",
    business_type: "plumber",
    rating: 4.8,
    reviews: 50,
    has_website: false,
    is_invalid: false,
    phone: "2405823272",
    review_highlights: [
      { excerpt: "Test review excerpt for CRM call testing.", rating: 5 },
    ],
  };

  const { error: bizError } = await supabase
    .from("businesses_nowebsite")
    .upsert(row, { onConflict: "place_id" });
  if (bizError) throw new Error(`businesses_nowebsite: ${bizError.message}`);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", TEST_EMAIL)
    .maybeSingle();
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  if (!profile) throw new Error(`Profile not found for ${TEST_EMAIL}`);

  const { error: contactError } = await supabase.from("crm_user_contacts").upsert(
    {
      user_id: profile.id,
      place_id: PLACE_ID,
      contact_count: 0,
      stage: "new",
      notes: "Test lead for outbound call testing — safe to delete.",
    },
    { onConflict: "user_id,place_id" },
  );
  if (contactError) throw new Error(`crm_user_contacts: ${contactError.message}`);

  const { data: verify, error: verifyError } = await supabase
    .from("businesses_nowebsite")
    .select("place_id, name, phone, rating, reviews")
    .eq("place_id", PLACE_ID)
    .single();
  if (verifyError) throw new Error(`verify: ${verifyError.message}`);

  console.log(JSON.stringify({ ok: true, verify, userId: profile.id }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
