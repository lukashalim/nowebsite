import type { CrmStage } from "@/lib/crm-stage";
import { isCrmStage } from "@/lib/crm-stage";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CrmUserContactRow {
  contact_count: number;
  stage: CrmStage;
  owner_name: string | null;
  notes: string | null;
  contact_email: string | null;
}

export const CRM_USER_CONTACT_SELECT =
  "contact_count, stage, owner_name, notes, contact_email" as const;

export const DEFAULT_CRM_USER_CONTACT: CrmUserContactRow = {
  contact_count: 0,
  stage: "new",
  owner_name: null,
  notes: null,
  contact_email: null,
};

export async function fetchCrmUserContact(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
): Promise<CrmUserContactRow> {
  const { data } = await supabase
    .from("crm_user_contacts")
    .select(CRM_USER_CONTACT_SELECT)
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_CRM_USER_CONTACT };
  }

  return {
    contact_count: Number(data.contact_count) || 0,
    stage: typeof data.stage === "string" && isCrmStage(data.stage)
      ? data.stage
      : "new",
    owner_name:
      typeof data.owner_name === "string" ? data.owner_name : null,
    notes: typeof data.notes === "string" ? data.notes : null,
    contact_email:
      typeof data.contact_email === "string" ? data.contact_email : null,
  };
}

export async function upsertCrmUserContact(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  patch: Partial<CrmUserContactRow>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await fetchCrmUserContact(supabase, userId, placeId);
  const merged = { ...existing, ...patch };

  const { error } = await supabase.from("crm_user_contacts").upsert(
    {
      user_id: userId,
      place_id: placeId,
      contact_count: merged.contact_count,
      stage: merged.stage,
      owner_name: merged.owner_name,
      notes: merged.notes,
      contact_email: merged.contact_email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,place_id" },
  );

  if (error) {
    const hint = /crm_user_contacts|schema cache/i.test(error.message)
      ? " Run scrape/sql/add-crm-stage-and-is-invalid.sql in Supabase."
      : "";
    return { ok: false, error: error.message + hint };
  }

  return { ok: true };
}
