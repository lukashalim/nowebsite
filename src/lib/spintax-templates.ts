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
  DEFAULT_EMAIL_SPINTAX_TEMPLATES,
  DEFAULT_FACEBOOK_SPINTAX_TEMPLATES,
  DEFAULT_SMS_SPINTAX_TEMPLATES,
} from "@/lib/spintax-defaults";

export interface SpintaxTemplate {
  id: string;
  name: string;
  template: string;
  pivot_template: string | null;
  offer_template: string | null;
  audience: SpintaxAudience;
  channel: SpintaxChannel;
  created_at: string;
}

function mapRow(row: Record<string, unknown>): SpintaxTemplate {
  const audienceRaw = String(row.audience ?? "facebook");
  const audience = isSpintaxAudience(audienceRaw) ? audienceRaw : "facebook";
  const channelRaw = String(row.channel ?? "facebook");
  const channel = isSpintaxChannel(channelRaw) ? channelRaw : "facebook";
  const pivotRaw = row.pivot_template;
  const offerRaw = row.offer_template;
  return {
    id: String(row.id),
    name: String(row.name),
    template: String(row.template),
    pivot_template:
      typeof pivotRaw === "string" && pivotRaw.trim() ? pivotRaw : null,
    offer_template:
      typeof offerRaw === "string" && offerRaw.trim() ? offerRaw : null,
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
    const hint = /spintax_templates|schema cache|audience|channel|pivot_template|offer_template/i.test(
      fetchError.message,
    )
      ? " Run scrape/sql/add-spintax-template-audience.sql, add-spintax-template-channel.sql, and add-spintax-call-script-steps.sql in Supabase."
      : "";
    return { ok: false, error: fetchError.message + hint };
  }

  const facebookAudiencesPresent = new Set<SpintaxAudience>();
  let hasSmsTemplates = false;
  let hasCallTemplates = false;
  let hasEmailTemplates = false;

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
    if (channel === "email") {
      hasEmailTemplates = true;
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
          pivot_template: t.pivot_template ?? null,
          offer_template: t.offer_template ?? null,
          audience: t.audience,
          channel: t.channel,
        }))),
    ...(hasEmailTemplates
      ? []
      : DEFAULT_EMAIL_SPINTAX_TEMPLATES.map((t) => ({
          user_id: userId,
          name: t.name,
          template: t.template,
          pivot_template: t.pivot_template ?? null,
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
    .select(
      "id, name, template, pivot_template, offer_template, audience, channel, created_at",
    )
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

function validateTemplateField(
  value: string,
  label: string,
): string | null {
  if (!value.trim()) return `${label} is required`;
  if (value.length > 4000) {
    return `${label} must be 4000 characters or less`;
  }
  return null;
}

export function validateSpintaxTemplateInput(
  name: string,
  template: string,
  audience?: string,
  channel?: string,
  pivotTemplate?: string | null,
  offerTemplate?: string | null,
): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) return "Name is required";
  if (trimmedName.length > 200) return "Name must be 200 characters or less";

  const templateLabel =
    channel === "call"
      ? "Hook template"
      : channel === "email"
        ? "Subject"
        : "Template";
  const templateError = validateTemplateField(template, templateLabel);
  if (templateError) return templateError;

  if (audience !== undefined && !isSpintaxAudience(audience)) {
    return "Invalid lead type";
  }
  if (channel !== undefined && !isSpintaxChannel(channel)) {
    return "Invalid channel";
  }

  if (channel === "call") {
    const pivotError = validateTemplateField(
      pivotTemplate ?? "",
      "Pivot template",
    );
    if (pivotError) return pivotError;
    const offerError = validateTemplateField(
      offerTemplate ?? "",
      "Offer template",
    );
    if (offerError) return offerError;
  }

  if (channel === "email") {
    const bodyError = validateTemplateField(pivotTemplate ?? "", "Body");
    if (bodyError) return bodyError;
  }

  return null;
}
