import { z } from "zod";
import { CRM_STAGE_VALUES, type CrmStage } from "@/lib/crm-stage";
import {
  CRM_TIMEZONE_VALUES,
  isCrmTimezone,
  type CrmTimezone,
} from "@/lib/crm-timezone";
import { CATEGORY_GROUP_IDS } from "@/lib/directory/category-group-ids";

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function intInRange(def: number, min: number, max: number) {
  return z.preprocess((val) => {
    if (val === undefined || val === "") return def;
    const n = Number.parseInt(String(val), 10);
    return Number.isFinite(n) ? n : def;
  }, z.number().int().min(min).max(max));
}

function floatInRange(def: number, min: number, max: number) {
  return z.preprocess((val) => {
    if (val === undefined || val === "") return def;
    const n = Number(String(val));
    return Number.isFinite(n) ? n : def;
  }, z.number().min(min).max(max));
}

const optionalInt = z.preprocess((val) => {
  if (val === undefined || val === "") return undefined;
  const n = Number.parseInt(String(val), 10);
  return Number.isFinite(n) ? n : undefined;
}, z.number().int().min(0).max(3).optional());

const optionalStage = z.preprocess((val) => {
  if (val === undefined || val === "") return undefined;
  const s = String(val).trim();
  if ((CRM_STAGE_VALUES as readonly string[]).includes(s)) {
    return s as CrmStage;
  }
  return undefined;
}, z.enum(CRM_STAGE_VALUES).optional());

const optionalFilterString = z.preprocess((val) => {
  if (val === undefined || val === "") return undefined;
  const s = String(val).trim();
  return s || undefined;
}, z.string().min(1).optional());

const optionalCategoryGroup = z.preprocess((val) => {
  if (val === undefined || val === "") return undefined;
  const s = String(val).trim().toLowerCase();
  if ((CATEGORY_GROUP_IDS as readonly string[]).includes(s)) {
    return s as (typeof CATEGORY_GROUP_IDS)[number];
  }
  return undefined;
}, z.enum(CATEGORY_GROUP_IDS).optional());

/** `plain` = legacy ?contactSurface=none (no FB/WA bucket only). `no` = legacy URL alias for `all`. */
export const crmWebPresenceValues = [
  "all",
  "no",
  "plain",
  "facebook",
  "whatsapp",
  "yes",
] as const;
export type CrmWebPresence = (typeof crmWebPresenceValues)[number];

export const crmPhoneLineTypeValues = [
  "all",
  "mobile",
  "landline_or_voip",
  "unknown",
  "not_checked",
] as const;
export type CrmPhoneLineType = (typeof crmPhoneLineTypeValues)[number];

/** Top-of-CRM outreach mode: filters the lead list by reachable surface. */
export const crmOutreachModeValues = ["all", "call", "text", "mail"] as const;
export type CrmOutreachMode = (typeof crmOutreachModeValues)[number];

export { CRM_TIMEZONE_VALUES, type CrmTimezone };

function parseTimezonesParam(
  value: string | string[] | undefined,
): CrmTimezone[] {
  if (value === undefined || value === "") return [];
  const parts = Array.isArray(value)
    ? value.flatMap((v) => String(v).split(","))
    : String(value).split(",");
  const seen = new Set<CrmTimezone>();
  for (const part of parts) {
    const normalized = part.trim().toLowerCase();
    if (isCrmTimezone(normalized)) seen.add(normalized);
  }
  return CRM_TIMEZONE_VALUES.filter((tz) => seen.has(tz));
}

const timezonesParam = z.preprocess(
  (val) => parseTimezonesParam(val as string | string[] | undefined),
  z.array(z.enum(CRM_TIMEZONE_VALUES)).default([]),
);

/** URL flag: switch CRM list/export to QA/test leads only (`is_test = true`). */
const showTestLeadsParam = z.preprocess((val) => {
  if (val === undefined || val === "" || val === false || val === "0")
    return false;
  if (val === true) return true;
  const s = String(val).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}, z.boolean().default(false));

export const crmSearchParamsSchema = z
  .object({
    minReviews: intInRange(25, 0, 1_000_000),
    maxReviews: intInRange(199, 0, 1_000_000),
    minRating: floatInRange(4, 0, 5),
    /** All = broad no-website cohort; Facebook / WhatsApp narrow by Maps listing; Yes = has a real site. */
    webPresence: z.enum(crmWebPresenceValues).default("all"),
    phoneLineType: z.enum(crmPhoneLineTypeValues).default("all"),
    outreachMode: z.enum(crmOutreachModeValues).default("all"),
    /** When true, list/export only `is_test` leads; when false, exclude them. */
    showTestLeads: showTestLeadsParam,
    page: intInRange(1, 1, 1_000_000),
    pageSize: intInRange(50, 1, 100),
    contactMin: optionalInt,
    contactMax: optionalInt,
    stage: optionalStage,
    categoryGroup: optionalCategoryGroup,
    category: optionalFilterString,
    state: optionalFilterString,
    timezones: timezonesParam,
  })
  .refine((d) => d.minReviews <= d.maxReviews, {
    message: "minReviews must be <= maxReviews",
    path: ["maxReviews"],
  })
  .refine(
    (d) =>
      d.contactMin === undefined ||
      d.contactMax === undefined ||
      d.contactMin <= d.contactMax,
    {
      message: "contactMin must be <= contactMax",
      path: ["contactMax"],
    },
  );

export type CrmSearchParams = z.infer<typeof crmSearchParamsSchema>;

/** CRM defaults (no query string): matches schema defaults. */
export function defaultCrmSearchParams(): CrmSearchParams {
  return crmSearchParamsSchema.parse({});
}

/** Filters used for public demo pages (default cohort only; no contact filters). */
export function defaultCrmDemoCohortFilters(): Pick<
  CrmSearchParams,
  "webPresence" | "minReviews" | "maxReviews" | "minRating"
> {
  const p = defaultCrmSearchParams();
  return {
    webPresence: "all",
    minReviews: p.minReviews,
    maxReviews: p.maxReviews,
    minRating: p.minRating,
  };
}

function normalizeWebPresence(
  raw: Record<string, string | string[] | undefined>,
): CrmWebPresence {
  const direct = firstParam(raw.webPresence)?.toLowerCase().trim();
  if (direct === "no") return "all";
  if (
    direct === "all" ||
    direct === "plain" ||
    direct === "facebook" ||
    direct === "whatsapp" ||
    direct === "yes"
  ) {
    return direct;
  }
  const hw = firstParam(raw.hasWebsite);
  if (hw === "true" || hw === "1") {
    return "yes";
  }
  const cs = firstParam(raw.contactSurface)?.toLowerCase().trim();
  if (cs === "facebook") return "facebook";
  if (cs === "whatsapp") return "whatsapp";
  if (cs === "none") {
    return "plain";
  }
  return "all";
}

function rawToFlat(raw: Record<string, string | string[] | undefined>) {
  return {
    minReviews: firstParam(raw.minReviews),
    maxReviews: firstParam(raw.maxReviews),
    minRating: firstParam(raw.minRating),
    webPresence: normalizeWebPresence(raw),
    phoneLineType: firstParam(raw.phoneLineType),
    outreachMode: firstParam(raw.outreachMode),
    showTestLeads: firstParam(raw.showTestLeads),
    page: firstParam(raw.page),
    pageSize: firstParam(raw.pageSize),
    contactMin: firstParam(raw.contactMin),
    contactMax: firstParam(raw.contactMax),
    stage: firstParam(raw.stage),
    categoryGroup: firstParam(raw.categoryGroup),
    category: firstParam(raw.category),
    state: firstParam(raw.state),
    timezones: raw.timezones,
  };
}

export function parseCrmSearchParams(
  raw: Record<string, string | string[] | undefined>,
): CrmSearchParams {
  return crmSearchParamsSchema.parse(rawToFlat(raw));
}

export function tryParseCrmSearchParams(
  raw: Record<string, string | string[] | undefined>,
):
  | { ok: true; data: CrmSearchParams }
  | { ok: false; issues: z.ZodIssue[] } {
  const result = crmSearchParamsSchema.safeParse(rawToFlat(raw));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: result.error.issues };
}

function appendCrmFilterParams(sp: URLSearchParams, params: CrmSearchParams): void {
  if (params.minReviews !== 25) sp.set("minReviews", String(params.minReviews));
  if (params.maxReviews !== 199) sp.set("maxReviews", String(params.maxReviews));
  if (params.minRating !== 4) sp.set("minRating", String(params.minRating));
  if (params.webPresence !== "all")
    sp.set("webPresence", params.webPresence);
  if (params.phoneLineType !== "all")
    sp.set("phoneLineType", params.phoneLineType);
  if (params.outreachMode !== "all")
    sp.set("outreachMode", params.outreachMode);
  if (params.showTestLeads) sp.set("showTestLeads", "1");
  if (params.contactMin !== undefined)
    sp.set("contactMin", String(params.contactMin));
  if (params.contactMax !== undefined)
    sp.set("contactMax", String(params.contactMax));
  if (params.stage !== undefined) sp.set("stage", params.stage);
  if (params.categoryGroup !== undefined)
    sp.set("categoryGroup", params.categoryGroup);
  if (params.category !== undefined) sp.set("category", params.category);
  if (params.state !== undefined) sp.set("state", params.state);
  for (const tz of params.timezones) {
    sp.append("timezones", tz);
  }
}

export function buildCrmQueryString(params: CrmSearchParams): string {
  const sp = new URLSearchParams();
  appendCrmFilterParams(sp, params);
  if (params.page !== 1) sp.set("page", String(params.page));
  if (params.pageSize !== 50) sp.set("pageSize", String(params.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** CRM CSV export: free users always send explicit page bounds; Pro omits them (server exports all matches). */
export function buildCrmExportQueryString(
  params: CrmSearchParams,
  options: { isPro: boolean },
): string {
  const sp = new URLSearchParams();
  appendCrmFilterParams(sp, params);
  if (!options.isPro) {
    sp.set("page", String(params.page));
    sp.set("pageSize", String(params.pageSize));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
