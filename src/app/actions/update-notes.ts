"use server";

import { revalidatePath } from "next/cache";
import { upsertCrmUserContact } from "@/app/actions/crm-user-contact";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateNotes(
  placeId: string,
  notes: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (notes !== null) {
    if (typeof notes !== "string") {
      return { ok: false, error: "Invalid notes" };
    }
    if (notes.length > 2000) {
      return { ok: false, error: "Notes must be 2000 characters or less" };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  try {
    const normalized =
      notes === null || notes.trim() === "" ? null : notes.trim();
    const res = await upsertCrmUserContact(supabase, user.id, placeId, {
      notes: normalized,
    });
    if (!res.ok) return res;

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
