import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SPINTAX_TEMPLATES } from "@/lib/spintax-defaults";

export interface SpintaxTemplate {
  id: string;
  name: string;
  template: string;
  created_at: string;
}

function mapRow(row: Record<string, unknown>): SpintaxTemplate {
  return {
    id: String(row.id),
    name: String(row.name),
    template: String(row.template),
    created_at: String(row.created_at),
  };
}

export async function ensureDefaultSpintaxTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { count, error: countError } = await supabase
    .from("spintax_templates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    const hint = /spintax_templates|schema cache/i.test(countError.message)
      ? " Run scrape/sql/create-spintax-templates.sql in Supabase."
      : "";
    return { ok: false, error: countError.message + hint };
  }

  if ((count ?? 0) > 0) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("spintax_templates").insert(
    DEFAULT_SPINTAX_TEMPLATES.map((t) => ({
      user_id: userId,
      name: t.name,
      template: t.template,
    })),
  );

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
    .select("id, name, template, created_at")
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
): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) return "Name is required";
  if (trimmedName.length > 200) return "Name must be 200 characters or less";
  if (!template.trim()) return "Template is required";
  if (template.length > 4000) return "Template must be 4000 characters or less";
  return null;
}
