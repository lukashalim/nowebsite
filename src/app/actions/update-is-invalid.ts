"use server";

import { revalidatePath } from "next/cache";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setLeadInvalid(
  placeId: string,
  isInvalid: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (typeof isInvalid !== "boolean") {
    return { ok: false, error: "Invalid flag" };
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
    const { error } = await admin
      .from("businesses_nowebsite")
      .update({ is_invalid: isInvalid })
      .eq("place_id", placeId);

    if (error) {
      const hint = /is_invalid|schema cache/i.test(error.message)
        ? " Run scrape/sql/add-crm-stage-and-is-invalid.sql in Supabase."
        : "";
      return { ok: false, error: error.message + hint };
    }

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
