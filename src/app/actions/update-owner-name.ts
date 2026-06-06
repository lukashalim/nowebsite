"use server";

import { revalidatePath } from "next/cache";
import { upsertCrmUserContact } from "@/app/actions/crm-user-contact";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateOwnerName(
  placeId: string,
  ownerName: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (ownerName !== null) {
    if (typeof ownerName !== "string") {
      return { ok: false, error: "Invalid owner name" };
    }
    const trimmed = ownerName.trim();
    if (trimmed.length > 100) {
      return { ok: false, error: "Owner name must be 100 characters or less" };
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
      ownerName === null || ownerName.trim() === ""
        ? null
        : ownerName.trim();
    const res = await upsertCrmUserContact(supabase, user.id, placeId, {
      owner_name: normalized,
    });
    if (!res.ok) return res;

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
