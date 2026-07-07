"use server";

import { revalidatePath } from "next/cache";
import { upsertCrmUserContact } from "@/app/actions/crm-user-contact";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateContactEmail(
  placeId: string,
  contactEmail: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (contactEmail !== null) {
    if (typeof contactEmail !== "string") {
      return { ok: false, error: "Invalid email" };
    }
    const trimmed = contactEmail.trim();
    if (trimmed.length > 320) {
      return { ok: false, error: "Email must be 320 characters or less" };
    }
    if (trimmed && !EMAIL_PATTERN.test(trimmed)) {
      return { ok: false, error: "Invalid email address" };
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
      contactEmail === null || contactEmail.trim() === ""
        ? null
        : contactEmail.trim().toLowerCase();
    const res = await upsertCrmUserContact(supabase, user.id, placeId, {
      contact_email: normalized,
    });
    if (!res.ok) return res;

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
