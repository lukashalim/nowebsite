import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSpintaxAudience,
  SPINTAX_AUDIENCE_VALUES,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import { DEFAULT_SPINTAX_TEMPLATES } from "@/lib/spintax-defaults";

export interface SpintaxTemplate {
  id: string;
  name: string;
  template: string;
  audience: SpintaxAudience;
  created_at: string;
}

function mapRow(row: Record<string, unknown>): SpintaxTemplate {
  const audienceRaw = String(row.audience ?? "facebook");
  const audience = isSpintaxAudience(audienceRaw) ? audienceRaw : "facebook";
  return {
    id: String(row.id),
    name: String(row.name),
    template: String(row.template),
    audience,
    created_at: String(row.created_at),
  };
}

export async function ensureDefaultSpintaxTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error: fetchError } = await supabase
    .from("spintax_templates")
    .select("audience")
    .eq("user_id", userId);

  if (fetchError) {
    const hint = /spintax_templates|schema cache|audience/i.test(fetchError.message)
      ? " Run scrape/sql/add-spintax-template-audience.sql in Supabase."
      : "";
    return { ok: false, error: fetchError.message + hint };
  }

  const audiencesPresent = new Set(
    (rows ?? []).map((row) => {
      const audience = String((row as { audience?: string }).audience ?? "facebook");
      return isSpintaxAudience(audience) ? audience : "facebook";
    }),
  );

  const audiencesToSeed = SPINTAX_AUDIENCE_VALUES.filter(
    (audience) => audience !== "any" && !audiencesPresent.has(audience),
  );

  if (audiencesToSeed.length === 0) {
    return { ok: true };
  }

  const toInsert = DEFAULT_SPINTAX_TEMPLATES.filter((t) =>
    audiencesToSeed.includes(t.audience),
  ).map((t) => ({
    user_id: userId,
    name: t.name,
    template: t.template,
    audience: t.audience,
  }));

  if (toInsert.length === 0) {
    return { ok: true };
  }

  const { error: insertError } = await supabase
    .from("spintax_templates")
    .insert(toInsert);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

export async function fetchSpintaxTemplatesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ templates: SpintaxTemplate[]; error: string | null }> {
  const ensured = await ensureDefaultSpintaxTemplates(supabase, userId);
  if (!ensured.ok) {
    return { templates: [], error: ensured.error };
  }

  const { data, error } = await supabase
    .from("spintax_templates")
    .select("id, name, template, audience, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return { templates: [], error: error.message };
  }

  return {
    templates: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    error: null,
  };
}

export function validateSpintaxTemplateInput(
  name: string,
  template: string,
  audience?: string,
): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) return "Name is required";
  if (trimmedName.length > 200) return "Name must be 200 characters or less";
  if (!template.trim()) return "Template is required";
  if (template.length > 4000) return "Template must be 4000 characters or less";
  if (audience !== undefined && !isSpintaxAudience(audience)) {
    return "Invalid lead type";
  }
  return null;
}
