import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const POSTCARD_STORAGE_BUCKET = "postcard-screenshots";
export const LOB_POSTCARD_WIDTH = 1275;
export const LOB_POSTCARD_HEIGHT = 1875;

export const MISSING_POSTCARD_SCREENSHOT_MESSAGE =
  "No postcard screenshot for this lead. Run generate-postcard-screenshots locally for your username, then retry.";

function sanitizePlaceId(placeId: string): string {
  return String(placeId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function postcardStoragePath(username: string, placeId: string): string {
  return `${username.trim()}/${sanitizePlaceId(placeId)}.jpg`;
}

export async function getExistingPostcardPublicUrl(
  username: string,
  placeId: string,
): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const path = postcardStoragePath(username, placeId);
  const { data: listed, error } = await supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .list(username.trim(), { search: sanitizePlaceId(placeId) });
  if (error) {
    // Bucket may not exist yet.
    return null;
  }
  const hit = (listed ?? []).some(
    (f) => f.name === `${sanitizePlaceId(placeId)}.jpg`,
  );
  if (!hit) return null;
  const { data } = supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * Resolve a pre-generated postcard front image from Storage.
 * Screenshots are captured locally via scrape/generate-postcard-screenshots.mjs.
 */
export async function ensurePostcardFrontUrl(input: {
  username: string;
  placeId: string;
}): Promise<string> {
  const existing = await getExistingPostcardPublicUrl(
    input.username,
    input.placeId,
  );
  if (existing) return existing;
  throw new Error(MISSING_POSTCARD_SCREENSHOT_MESSAGE);
}
