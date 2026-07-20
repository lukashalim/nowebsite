/**
 * Persist short scan link IDs for Lob QR redirect_url.
 * Lob wraps destination URLs; long signed ?t= tokens get mangled → invalid token.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import type { PostcardScanPayload } from "@/lib/postcard/scan-link";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const POSTCARD_SCAN_LINKS_TABLE = "postcard_scan_links";

/** Always production — Lob prints and phones must not hit localhost. */
const POSTCARD_SCAN_ORIGIN = "https://www.nowebsitebusinessleads.com";

function newScanId(): string {
  // 10 bytes → 16 chars base64url; URL-safe, short for Lob QR.
  return randomBytes(10).toString("base64url");
}

export async function createPostcardScanLinkUrl(
  payload: PostcardScanPayload,
): Promise<string> {
  const id = newScanId();
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from(POSTCARD_SCAN_LINKS_TABLE).insert({
    id,
    user_id: payload.userId.trim(),
    place_id: payload.placeId.trim(),
    username: payload.username.trim(),
    slug: payload.slug.trim(),
    is_test: Boolean(payload.isTest),
  });
  if (error) {
    throw new Error(`Failed to create postcard scan link: ${error.message}`);
  }
  return `${POSTCARD_SCAN_ORIGIN}/api/postcard-scan?id=${encodeURIComponent(id)}`;
}

export async function resolvePostcardScanLink(
  id: string,
): Promise<PostcardScanPayload | null> {
  const key = id.trim();
  if (!key || key.length > 64) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from(POSTCARD_SCAN_LINKS_TABLE)
    .select("user_id, place_id, username, slug, is_test")
    .eq("id", key)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    user_id: string;
    place_id: string;
    username: string;
    slug: string;
    is_test: boolean;
  };
  if (
    !row.user_id?.trim() ||
    !row.place_id?.trim() ||
    !row.username?.trim() ||
    !row.slug?.trim()
  ) {
    return null;
  }
  return {
    userId: row.user_id.trim(),
    placeId: row.place_id.trim(),
    username: row.username.trim(),
    slug: row.slug.trim(),
    isTest: Boolean(row.is_test),
  };
}
