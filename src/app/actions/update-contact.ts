"use server";

import { revalidatePath } from "next/cache";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateContactCount(
  placeId: string,
  contactCount: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (
    !Number.isInteger(contactCount) ||
    contactCount < -1 ||
    contactCount > 3
  ) {
    return { ok: false, error: "Invalid contact count" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  try {
    if (contactCount === -1) {
      const admin = createSupabaseAdmin();
      const { error } = await admin
        .from("businesses_nowebsite")
        .update({ contact_count: contactCount })
        .eq("place_id", placeId);

      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await supabase.from("crm_user_contacts").upsert(
        {
          user_id: user.id,
          place_id: placeId,
          contact_count: contactCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,place_id" },
      );

      if (error) {
        const hint = /crm_user_contacts|schema cache/i.test(error.message)
          ? " Run scrape/sql/create-crm-user-contacts.sql in Supabase."
          : "";
        return { ok: false, error: error.message + hint };
      }
    }

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
