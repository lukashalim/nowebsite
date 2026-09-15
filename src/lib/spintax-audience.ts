import {
  isEligibleForFacebookListingOutreach,
  type FacebookOutreachRow,
} from "@/lib/outreach-spintax";
import {
  filterSpintaxTemplatesByChannel,
  type SpintaxChannel,
} from "@/lib/spintax-channel";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

export const SPINTAX_AUDIENCE_VALUES = [
  "facebook",
  "no_facebook",
  "any",
  "angi",
] as const;

export type SpintaxAudience = (typeof SPINTAX_AUDIENCE_VALUES)[number];

export const SPINTAX_AUDIENCE_LABELS: Record<SpintaxAudience, string> = {
  facebook: "Facebook listing",
  no_facebook: "No Facebook",
  any: "Any lead type",
  angi: "On Angi",
};

export interface SpintaxLeadAudienceContext {
  /** Facebook vs no-Facebook surface. */
  surface: "facebook" | "no_facebook";
  hasAngiListing: boolean;
}

export interface AngiAwareOutreachRow extends FacebookOutreachRow {
  has_angi_listing?: boolean | null;
}

export function isSpintaxAudience(value: string): value is SpintaxAudience {
  return (SPINTAX_AUDIENCE_VALUES as readonly string[]).includes(value);
}

export function leadSpintaxAudienceContext(
  row: AngiAwareOutreachRow,
): SpintaxLeadAudienceContext {
  return {
    surface: isEligibleForFacebookListingOutreach(row)
      ? "facebook"
      : "no_facebook",
    hasAngiListing: row.has_angi_listing === true,
  };
}

/** @deprecated Prefer leadSpintaxAudienceContext; kept for surface-only call sites. */
export function leadSpintaxAudience(
  row: AngiAwareOutreachRow,
): SpintaxAudience {
  return leadSpintaxAudienceContext(row).surface;
}

export function templateMatchesLeadAudience(
  templateAudience: SpintaxAudience,
  leadAudience: SpintaxAudience | SpintaxLeadAudienceContext,
): boolean {
  if (typeof leadAudience === "string") {
    return templateAudience === "any" || templateAudience === leadAudience;
  }
  if (templateAudience === "any") return true;
  if (templateAudience === "angi") return leadAudience.hasAngiListing;
  return templateAudience === leadAudience.surface;
}

export function filterSpintaxTemplatesForLead(
  templates: SpintaxTemplate[],
  row: AngiAwareOutreachRow,
): SpintaxTemplate[] {
  return filterSpintaxTemplatesByAudience(
    templates,
    leadSpintaxAudienceContext(row),
  );
}

export function filterSpintaxTemplatesByAudience(
  templates: SpintaxTemplate[],
  leadAudience: SpintaxAudience | SpintaxLeadAudienceContext,
): SpintaxTemplate[] {
  return templates.filter((t) =>
    templateMatchesLeadAudience(t.audience, leadAudience),
  );
}

export function filterSpintaxTemplatesForLeadChannel(
  templates: SpintaxTemplate[],
  channel: SpintaxChannel,
  leadAudience: SpintaxAudience | SpintaxLeadAudienceContext,
): SpintaxTemplate[] {
  return filterSpintaxTemplatesByAudience(
    filterSpintaxTemplatesByChannel(templates, channel),
    leadAudience,
  );
}

/** Prefer Angi-specific templates when the lead is on Angi. */
export function preferAngiSpintaxTemplate(
  templates: SpintaxTemplate[],
  preferredId?: string | null,
): SpintaxTemplate | undefined {
  if (preferredId) {
    const byId = templates.find((t) => t.id === preferredId);
    if (byId) return byId;
  }
  return (
    templates.find((t) => t.audience === "angi") ?? templates[0] ?? undefined
  );
}
