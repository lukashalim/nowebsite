"use server";

import { parseReviewHighlights } from "@/lib/demo-review-types";
import { inferOwnerNameFromReviews } from "@/lib/owner-name-from-reviews";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function suggestOwnerNameFromReviews(
  placeId: string,
): Promise<
  { ok: true; ownerName: string | null } | { ok: false; error: string }
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

    return { ok: true, ownerName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Suggestion failed";
    return { ok: false, error: msg };
  }
}
