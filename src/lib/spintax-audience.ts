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
] as const;

export type SpintaxAudience = (typeof SPINTAX_AUDIENCE_VALUES)[number];

export const SPINTAX_AUDIENCE_LABELS: Record<SpintaxAudience, string> = {
  facebook: "Facebook listing",
  no_facebook: "No Facebook",
  any: "Any lead type",
};

export function isSpintaxAudience(value: string): value is SpintaxAudience {
  return (SPINTAX_AUDIENCE_VALUES as readonly string[]).includes(value);
}

export function leadSpintaxAudience(row: FacebookOutreachRow): SpintaxAudience {
  return isEligibleForFacebookListingOutreach(row) ? "facebook" : "no_facebook";
}

export function templateMatchesLeadAudience(
  templateAudience: SpintaxAudience,
  leadAudience: SpintaxAudience,
): boolean {
  return templateAudience === "any" || templateAudience === leadAudience;
}

export function filterSpintaxTemplatesForLead(
  templates: SpintaxTemplate[],
  row: FacebookOutreachRow,
): SpintaxTemplate[] {
  return filterSpintaxTemplatesByAudience(templates, leadSpintaxAudience(row));
}

export function filterSpintaxTemplatesByAudience(
  templates: SpintaxTemplate[],
  leadAudience: SpintaxAudience,
): SpintaxTemplate[] {
  return templates.filter((t) =>
    templateMatchesLeadAudience(t.audience, leadAudience),
  );
}

export function filterSpintaxTemplatesForLeadChannel(
  templates: SpintaxTemplate[],
  channel: SpintaxChannel,
  leadAudience: SpintaxAudience,
): SpintaxTemplate[] {
  return filterSpintaxTemplatesByAudience(
    filterSpintaxTemplatesByChannel(templates, channel),
    leadAudience,
  );
}
