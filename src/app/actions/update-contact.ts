"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function updateContactCount(
  placeId: string,
  contactCount: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (
    !Number.isInteger(contactCount) ||
    contactCount < 0 ||
    contactCount > 50
  ) {
    return { ok: false, error: "Invalid contact count" };
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("businesses")
      .update({ contact_count: contactCount })
      .eq("place_id", placeId);

    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
