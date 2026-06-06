"use server";

import { revalidatePath } from "next/cache";
import { upsertCrmUserContact } from "@/app/actions/crm-user-contact";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { isCrmStage, type CrmStage } from "@/lib/crm-stage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateLeadStage(
  placeId: string,
  stage: CrmStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  if (!isCrmStage(stage)) {
    return { ok: false, error: "Invalid stage" };
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
      stage,
    });
    if (!res.ok) return res;

    revalidatePath(CRM_BASE_PATH);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
