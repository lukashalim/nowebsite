/**
 * Backfill SendFox list subscriptions for profiles missing sendfox_subscribed_at.
 *
 * Run: npx tsx scripts/backfill-sendfox-subscriptions.ts
 *
 * Requires in .env.local:
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SENDFOX_PERSONAL_ACCESS_TOKEN (or SENDFOX_PERSIONAL_ACCESS_TOKEN)
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { addContactToList, getContactByEmail } from "../src/lib/sendfox";

config({ path: resolve(process.cwd(), ".env.local") });

const DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function syncProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  await addContactToList(normalized);

  const now = new Date().toISOString();
  let confirmedAt: string | null = null;

  try {
    const contact = await getContactByEmail(normalized);
    confirmedAt = contact?.confirmed_at ?? null;
  } catch {
    // Subscription was attempted; confirmation can be refreshed later.
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      sendfox_subscribed_at: now,
      sendfox_confirmed_at: confirmedAt,
      updated_at: now,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const token =
    process.env.SENDFOX_PERSONAL_ACCESS_TOKEN ??
    process.env.SENDFOX_PERSIONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Missing SENDFOX_PERSONAL_ACCESS_TOKEN (or SENDFOX_PERSIONAL_ACCESS_TOKEN) in .env.local",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .not("email", "is", null)
    .is("sendfox_subscribed_at", null)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  let succeeded = 0;
  let failed = 0;

  console.log(`Found ${rows.length} profile(s) to backfill.`);

  for (const row of rows) {
    const userId = String(row.id);
    const email = typeof row.email === "string" ? row.email.trim() : "";
    if (!email) {
      failed += 1;
      console.warn(`Skipping ${userId}: missing email`);
      continue;
    }

    try {
      const subscribed = await syncProfile(supabase, userId, email);
      if (subscribed) {
        succeeded += 1;
        console.log(`Subscribed ${userId}`);
      } else {
        failed += 1;
        console.warn(`No subscription for ${userId}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`Failed ${userId}:`, err);
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `Done. processed=${rows.length} succeeded=${succeeded} failed=${failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
