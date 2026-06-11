"use server";

import { revalidatePath } from "next/cache";
import {
  fetchCrmUserContact,
  upsertCrmUserContact,
} from "@/app/actions/crm-user-contact";
import { parseReviewHighlights } from "@/lib/demo-review-types";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { inferOwnerNameFromReviews } from "@/lib/owner-name-from-reviews";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function suggestOwnerNameFromReviews(
  placeId: string,
): Promise<
  | { ok: true; ownerName: string | null; saved?: boolean; skipped?: boolean }
  | { ok: false; error: string }
> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  try {
    const contact = await fetchCrmUserContact(supabase, user.id, placeId);
    const existing = contact.owner_name?.trim();
    if (existing) {
      return { ok: true, ownerName: existing, skipped: true };
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("businesses_nowebsite")
      .select("review_highlights, name")
      .eq("place_id", placeId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data) {
      return { ok: true, ownerName: null };
    }

    const reviews = parseReviewHighlights(data.review_highlights);
    if (!reviews || reviews.length === 0) {
      return { ok: true, ownerName: null };
    }

    const businessName = typeof data.name === "string" ? data.name : null;
    const ownerName = await inferOwnerNameFromReviews(businessName, reviews);

    if (!ownerName) {
      return { ok: true, ownerName: null };
    }

    const saveRes = await upsertCrmUserContact(supabase, user.id, placeId, {
      owner_name: ownerName,
    });
    if (!saveRes.ok) {
      return saveRes;
    }

    revalidatePath(CRM_BASE_PATH);
    return { ok: true, ownerName, saved: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suggestion failed";
    return { ok: false, error: msg };
  }
}
