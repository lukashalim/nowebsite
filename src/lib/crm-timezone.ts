import { stateToAbbr } from "@/lib/directory/slugs";

export const CRM_TIMEZONE_VALUES = [
  "eastern",
  "central",
  "mountain",
  "pacific",
] as const;

export type CrmTimezone = (typeof CRM_TIMEZONE_VALUES)[number];

export const CRM_TIMEZONE_LABELS: Record<CrmTimezone, string> = {
  eastern: "Eastern (ET)",
  central: "Central (CT)",
  mountain: "Mountain (MT)",
  pacific: "Pacific (PT)",
};

const EASTERN_STATES = new Set([
  "ct",
  "de",
  "dc",
  "fl",
  "ga",
  "in",
  "ky",
  "me",
  "md",
  "ma",
  "mi",
  "nh",
  "nj",
  "ny",
  "nc",
  "oh",
  "pa",
  "ri",
  "sc",
  "tn",
  "vt",
  "va",
  "wv",
]);

const CENTRAL_STATES = new Set([
  "al",
  "ar",
  "il",
  "ia",
  "ks",
  "la",
  "mn",
  "ms",
  "mo",
  "ne",
  "nd",
  "ok",
  "sd",
  "tx",
  "wi",
]);

const MOUNTAIN_STATES = new Set(["az", "co", "id", "mt", "nm", "ut", "wy"]);

const PACIFIC_STATES = new Set(["ca", "nv", "or", "wa"]);

export function isCrmTimezone(value: string): value is CrmTimezone {
  return (CRM_TIMEZONE_VALUES as readonly string[]).includes(value);
}

export function crmTimezoneForUsState(
  state: string | null | undefined,
): CrmTimezone | null {
  const abbr = stateToAbbr(state ?? "");
  if (!abbr) return null;

  if (EASTERN_STATES.has(abbr)) return "eastern";
  if (CENTRAL_STATES.has(abbr)) return "central";
  if (MOUNTAIN_STATES.has(abbr)) return "mountain";
  if (PACIFIC_STATES.has(abbr)) return "pacific";
  return null;
}
