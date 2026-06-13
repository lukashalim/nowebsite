import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSpintaxAudience,
  SPINTAX_AUDIENCE_VALUES,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import {
  isSpintaxChannel,
  type SpintaxChannel,
} from "@/lib/spintax-channel";
import {
  DEFAULT_CALL_SPINTAX_TEMPLATES,
  DEFAULT_FACEBOOK_SPINTAX_TEMPLATES,
  DEFAULT_SMS_SPINTAX_TEMPLATES,
} from "@/lib/spintax-defaults";

export interface SpintaxTemplate {
  id: string;
  name: string;
  template: string;
  audience: SpintaxAudience;
  channel: SpintaxChannel;
  created_at: string;
}

function mapRow(row: Record<string, unknown>): SpintaxTemplate {
  const audienceRaw = String(row.audience ?? "facebook");
  const audience = isSpintaxAudience(audienceRaw) ? audienceRaw : "facebook";
  const channelRaw = String(row.channel ?? "facebook");
  const channel = isSpintaxChannel(channelRaw) ? channelRaw : "facebook";
  return {
    id: String(row.id),
    name: String(row.name),
    template: String(row.template),
    audience,
    channel,
    created_at: String(row.created_at),
  };
}

export async function ensureDefaultSpintaxTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error: fetchError } = await supabase
    .from("spintax_templates")
    .select("audience, channel")
    .eq("user_id", userId);

  if (fetchError) {
    const hint = /spintax_templates|schema cache|audience|channel/i.test(
      fetchError.message,
    )
      ? " Run scrape/sql/add-spintax-template-audience.sql and add-spintax-template-channel.sql in Supabase."
      : "";
    return { ok: false, error: fetchError.message + hint };
  }

  const facebookAudiencesPresent = new Set<SpintaxAudience>();
  let hasSmsTemplates = false;
  let hasCallTemplates = false;

  for (const row of rows ?? []) {
    const record = row as { audience?: string; channel?: string };
    const channelRaw = String(record.channel ?? "facebook");
    const channel = isSpintaxChannel(channelRaw) ? channelRaw : "facebook";
    if (channel === "sms") {
      hasSmsTemplates = true;
      continue;
    }
    if (channel === "call") {
      hasCallTemplates = true;
      continue;
    }
    const audienceRaw = String(record.audience ?? "facebook");
    const audience = isSpintaxAudience(audienceRaw) ? audienceRaw : "facebook";
    facebookAudiencesPresent.add(audience);
  }

  const facebookAudiencesToSeed = SPINTAX_AUDIENCE_VALUES.filter(
    (audience) => audience !== "any" && !facebookAudiencesPresent.has(audience),
  );

  const toInsert = [
    ...DEFAULT_FACEBOOK_SPINTAX_TEMPLATES.filter((t) =>
      facebookAudiencesToSeed.includes(t.audience),
    ).map((t) => ({
      user_id: userId,
      name: t.name,
      template: t.template,
      audience: t.audience,
      channel: t.channel,
    })),
    ...(hasSmsTemplates
      ? []
      : DEFAULT_SMS_SPINTAX_TEMPLATES.map((t) => ({
          user_id: userId,
          name: t.name,
          template: t.template,
          audience: t.audience,
          channel: t.channel,
        }))),
    ...(hasCallTemplates
      ? []
      : DEFAULT_CALL_SPINTAX_TEMPLATES.map((t) => ({
          user_id: userId,
          name: t.name,
          template: t.template,
          audience: t.audience,
          channel: t.channel,
        }))),
  ];

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
    .select("id, name, template, audience, channel, created_at")
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
  channel?: string,
): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) return "Name is required";
  if (trimmedName.length > 200) return "Name must be 200 characters or less";
  if (!template.trim()) return "Template is required";
  if (template.length > 4000) return "Template must be 4000 characters or less";
  if (audience !== undefined && !isSpintaxAudience(audience)) {
    return "Invalid lead type";
  }
  if (channel !== undefined && !isSpintaxChannel(channel)) {
    return "Invalid channel";
  }
  return null;
}
