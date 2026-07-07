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
export const SPINTAX_PREVIEW_SAMPLE_OWNER_NAME = "Joe";
export const SPINTAX_PREVIEW_SAMPLE_CATEGORY = "plumber";
export const SPINTAX_PREVIEW_SAMPLE_DEMO_LINK =
  "https://ringreadysite.com/demo/joes-pizza";
export const SPINTAX_PREVIEW_SAMPLE_SENDER_NAME = "Alex";

export function categoryLabelForOutreach(
  mainCategory: string | null | undefined,
  businessType: string | null | undefined,
): string {
  const raw = directoryCategoryLabel(mainCategory, businessType);
  if (!raw) return "local business";
  return formatCategoryDisplayName(raw).toLowerCase();
}

/** Pick one random option from each `{a|b|c}` group (groups without `|` are left intact). */
export function resolveSpintax(template: string): string {
  return template.replace(/\{([^{}]+)\}/g, (match, group: string) => {
    if (!group.includes("|")) return match;
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
  ownerName?: string | null;
  mainCategory?: string | null;
  businessType?: string | null;
  demoLink?: string | null;
  senderName?: string | null;
}

function outreachNameToken(opts: OutreachTokenOpts): string {
  const owner = opts.ownerName?.trim();
  if (owner) return owner;
  const business = opts.name?.trim();
  if (business) return business;
  return "there";
}

function outreachBusinessNameToken(opts: OutreachTokenOpts): string {
  return opts.name?.trim() || "your business";
}

export function applyOutreachTokens(
  template: string,
  opts: OutreachTokenOpts,
): string {
  const nameToken = outreachNameToken(opts);
  const businessName = outreachBusinessNameToken(opts);
  const category = categoryLabelForOutreach(
    opts.mainCategory,
    opts.businessType,
  );
  const demoLink = opts.demoLink?.trim() || SPINTAX_PREVIEW_SAMPLE_DEMO_LINK;
  const senderName =
    opts.senderName?.trim() || SPINTAX_PREVIEW_SAMPLE_SENDER_NAME;

  return template
    .replaceAll("[Name]", nameToken)
    .replaceAll("{Name}", nameToken)
    .replaceAll("[category]", category)
    .replaceAll("{Business Name}", businessName)
    .replaceAll("{demo_link}", demoLink)
    .replaceAll("{Your name}", senderName);
}

export function buildOutreachMessage(
  template: string,
  opts: OutreachTokenOpts,
): string {
  return resolveSpintax(applyOutreachTokens(template, opts));
}

export function defaultSpintaxPreviewOpts(
  overrides?: Partial<OutreachTokenOpts>,
): OutreachTokenOpts {
  return {
    name: SPINTAX_PREVIEW_SAMPLE_NAME,
    ownerName: SPINTAX_PREVIEW_SAMPLE_OWNER_NAME,
    mainCategory: SPINTAX_PREVIEW_SAMPLE_CATEGORY,
    businessType: null,
    demoLink: SPINTAX_PREVIEW_SAMPLE_DEMO_LINK,
    senderName: SPINTAX_PREVIEW_SAMPLE_SENDER_NAME,
    ...overrides,
  };
}

export function buildSpintaxPreview(
  template: string,
  overrides?: Partial<OutreachTokenOpts>,
): string {
  return buildOutreachMessage(template, defaultSpintaxPreviewOpts(overrides));
}
