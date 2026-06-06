import { formatCategoryDisplayName } from "@/lib/directory/labels";
import { directoryCategoryLabel } from "@/lib/directory/slugs";
import type { CrmWebPresence } from "@/lib/crm-params";

/** Strip legal suffixes; keep up to ~3 words / 28 chars for casual outreach. */
export function shortenBusinessNameForOutreach(full: string | null): string {
  if (!full?.trim()) return "there";
  let s = full
    .replace(
      /\b(LLC|L\.L\.C\.|L\.L\.C|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.|Company|Ltd\.?|Limited|PLLC|P\.L\.L\.C\.)\b/gi,
      "",
    )
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

export function isEligibleForFacebookListingOutreach(
  row: FacebookOutreachRow,
): boolean {
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

/** Best Facebook page URL for opening Messenger / page (facebook_url or FB listing_website). */
export function resolveFacebookPageUrl(row: FacebookOutreachRow): string | null {
  const fb = row.facebook_url?.trim();
  if (fb) return fb;
  const listing = row.listing_website?.trim() ?? "";
  if (/facebook\.com|fb\.com|fb\.me/i.test(listing)) {
    return listing;
  }
  return null;
}

/** CRM spintax: enabled for no-website cohorts (Has website = No and sub-filters). */
export function isEligibleForCrmSpintax(
  webPresence: CrmWebPresence,
  row: FacebookOutreachRow,
): boolean {
  if (webPresence === "yes") return false;
  if (webPresence === "all" || webPresence === "no" || webPresence === "plain")
    return true;
  if (webPresence === "facebook" || webPresence === "whatsapp") return true;
  return isEligibleForFacebookListingOutreach(row);
}

export const SPINTAX_PREVIEW_SAMPLE_NAME = "Joe's Pizza";
export const SPINTAX_PREVIEW_SAMPLE_CATEGORY = "plumber";

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
    const options = group
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length === 0) return "";
    return options[Math.floor(Math.random() * options.length)] ?? "";
  });
}

export interface OutreachTokenOpts {
  name: string | null;
  mainCategory?: string | null;
  businessType?: string | null;
}

export function applyOutreachTokens(
  template: string,
  opts: OutreachTokenOpts,
): string {
  const shortName = shortenBusinessNameForOutreach(opts.name);
  const category = categoryLabelForOutreach(
    opts.mainCategory,
    opts.businessType,
  );
  return template.replaceAll("[Name]", shortName).replaceAll("[category]", category);
}

export function buildOutreachMessage(
  template: string,
  opts: OutreachTokenOpts,
): string {
  return resolveSpintax(applyOutreachTokens(template, opts));
}

export function buildSpintaxPreview(template: string): string {
  return buildOutreachMessage(template, {
    name: SPINTAX_PREVIEW_SAMPLE_NAME,
    mainCategory: SPINTAX_PREVIEW_SAMPLE_CATEGORY,
    businessType: null,
  });
}
