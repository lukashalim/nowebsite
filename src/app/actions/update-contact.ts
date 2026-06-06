"use server";

import { revalidatePath } from "next/cache";
import {
  fetchCrmUserContact,
  upsertCrmUserContact,
} from "@/app/actions/crm-user-contact";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_CONTACT_COUNT = 3;

function validateContactCount(contactCount: number): string | null {
  if (
    !Number.isInteger(contactCount) ||
    contactCount < 0 ||
    contactCount > MAX_CONTACT_COUNT
  ) {
    return "Invalid contact count";
  }
  return null;
}

export async function updateContactCount(
  placeId: string,
  contactCount: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }

  const countError = validateContactCount(contactCount);
  if (countError) {
    return { ok: false, error: countError };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  try {
    const res = await upsertCrmUserContact(supabase, user.id, placeId, {
      contact_count: contactCount,
    });
    if (!res.ok) return res;

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function incrementContactCount(
  placeId: string,
): Promise<
  { ok: true; contactCount: number } | { ok: false; error: string }
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
    const existing = await fetchCrmUserContact(supabase, user.id, placeId);
    const contactCount = Math.min(MAX_CONTACT_COUNT, existing.contact_count + 1);

    const res = await upsertCrmUserContact(supabase, user.id, placeId, {
      contact_count: contactCount,
    });
    if (!res.ok) return res;

    return { ok: true, contactCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
