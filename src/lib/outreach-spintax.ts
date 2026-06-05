import { formatCategoryDisplayName } from "@/lib/directory/labels";
import { directoryCategoryLabel } from "@/lib/directory/slugs";

/** Strip legal suffixes; keep up to ~3 words / 28 chars for casual outreach. */
export function shortenBusinessNameForOutreach(full: string | null): string {
  if (!full?.trim()) return "there";
  let s = full
    .replace(/\b(LLC|L\.L\.C\.|L\.L\.C|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.|Company|Ltd\.?|Limited|PLLC|P\.L\.L\.C\.)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  const take = words.slice(0, Math.min(3, words.length)).join(" ");
  if (take.length <= 28) return take || "there";
  return `${take.slice(0, 26).trimEnd()}…`;
}

export interface FacebookOutreachRow {
  place_id: string;
  name: string | null;
  facebook_url: string | null;
  crm_contact_surface: string | null;
  listing_website: string | null;
}

export function isEligibleForFacebookListingOutreach(row: FacebookOutreachRow): boolean {
  const listing = row.listing_website?.trim() ?? "";
  const listingIsFb = /facebook\.com|fb\.com|fb\.me/i.test(listing);
  const fb = row.facebook_url?.trim() ?? "";

  if (row.crm_contact_surface === "whatsapp") {
    return listingIsFb || Boolean(fb);
  }
  if (row.crm_contact_surface === "facebook") return true;
  if (listingIsFb) return true;
  return Boolean(fb);
}

export const FACEBOOK_LISTING_OUTREACH_SPINTAX_TEMPLATE =
  "{Hey|Hi|Hello} [Name] {—|-} {noticed|saw|spotted} your Google {listing|profile|business profile} {uses|has|links} Facebook as the {main|primary} website link. Google actually {added|created|set up} a {specific|dedicated|separate} spot just for social links now. When {mobile users|people on their phone|customers on mobile} tap '{Website|the website button}' and land on Facebook instead of a {fast|clean|dedicated} page with your {number|contact info}, {a lot of them|most people|many of them} just {bounce and call|leave and call|move on to} a {competitor|another business}. {Shot|Put together|Made} a quick {45-second|short} video showing how this {leaks customers|costs you customers} on mobile and how to {structure it|fix it|set it up} instead. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}";

export const FACEBOOK_LISTING_OUTREACH_AI_SPINTAX_TEMPLATE =
  "{Hey|Hi|Hello} [Name] - I was {looking you up|checking you out|searching for you} on Google and noticed you're using Facebook as your {website|main website link|web presence}. That's {great|perfect|fine} for people already on Facebook, but more and more people are asking AI to help them find {[category]|a [category]|local [category]} in their area - and AI can't read Facebook pages. {Shot|Put together|Made} a quick {45-second|short} video showing how this {costs you customers|leaks customers|affects your business} and how to {fix it|structure it instead|set it up properly}. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}";

export type OutreachTemplateVariant = "mobile" | "ai";

/** Stable 50/50 template assignment per lead. */
export function outreachTemplateVariant(placeId: string): OutreachTemplateVariant {
  let h = 0;
  for (const c of placeId) h = (h + c.charCodeAt(0)) | 0;
  return (h & 1) === 0 ? "mobile" : "ai";
}

export function categoryLabelForOutreach(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string {
  const raw = directoryCategoryLabel(mainCategory, businessType);
  if (!raw) return "local business";
  return formatCategoryDisplayName(raw).toLowerCase();
}

/** Pick one random option from each `{a|b|c}` group. */
export function resolveSpintax(template: string): string {
  return template.replace(/\{([^{}]+)\}/g, (_, group: string) => {
    const options = group.split("|").map((s) => s.trim()).filter(Boolean);
    if (options.length === 0) return "";
    return options[Math.floor(Math.random() * options.length)] ?? "";
  });
}

export interface BuildFacebookListingSpintaxOpts {
  placeId: string;
  name: string | null;
  mainCategory?: string | null;
  businessType?: string | null;
}

export function buildFacebookListingSpintax(opts: BuildFacebookListingSpintaxOpts): string {
  const variant = outreachTemplateVariant(opts.placeId);
  const template =
    variant === "ai"
      ? FACEBOOK_LISTING_OUTREACH_AI_SPINTAX_TEMPLATE
      : FACEBOOK_LISTING_OUTREACH_SPINTAX_TEMPLATE;
  const shortName = shortenBusinessNameForOutreach(opts.name);
  const category = categoryLabelForOutreach(opts.mainCategory, opts.businessType);
  const withTokens = template
    .replaceAll("[Name]", shortName)
    .replaceAll("[category]", category);
  return resolveSpintax(withTokens);
}
