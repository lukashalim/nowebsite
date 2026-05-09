import { z } from "zod";

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
}, z.number().int().min(0).max(50).optional());

/** `plain` = legacy ?contactSurface=none (no FB/WA bucket only); not shown in the CRM dropdown. */
export const crmWebPresenceValues = [
  "no",
  "plain",
  "facebook",
  "whatsapp",
  "yes",
] as const;
export type CrmWebPresence = (typeof crmWebPresenceValues)[number];

export const crmSearchParamsSchema = z
  .object({
    minReviews: intInRange(25, 0, 1_000_000),
    maxReviews: intInRange(199, 0, 1_000_000),
    minRating: floatInRange(4, 0, 5),
    /** No = no standalone website (broad); Facebook / WhatsApp narrow by Maps listing; Yes = has a real site. */
    webPresence: z.enum(crmWebPresenceValues).default("no"),
    page: intInRange(1, 1, 1_000_000),
    pageSize: intInRange(50, 1, 100),
    contactMin: optionalInt,
    contactMax: optionalInt,
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
    webPresence: p.webPresence,
    minReviews: p.minReviews,
    maxReviews: p.maxReviews,
    minRating: p.minRating,
  };
}

function normalizeWebPresence(
  raw: Record<string, string | string[] | undefined>,
): CrmWebPresence {
  const direct = firstParam(raw.webPresence)?.toLowerCase().trim();
  if (
    direct === "no" ||
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
    return "no";
  }
  return "no";
}

function rawToFlat(raw: Record<string, string | string[] | undefined>) {
  return {
    minReviews: firstParam(raw.minReviews),
    maxReviews: firstParam(raw.maxReviews),
    minRating: firstParam(raw.minRating),
    webPresence: normalizeWebPresence(raw),
    page: firstParam(raw.page),
    pageSize: firstParam(raw.pageSize),
    contactMin: firstParam(raw.contactMin),
    contactMax: firstParam(raw.contactMax),
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

export function buildCrmQueryString(params: CrmSearchParams): string {
  const sp = new URLSearchParams();
  if (params.minReviews !== 25) sp.set("minReviews", String(params.minReviews));
  if (params.maxReviews !== 199) sp.set("maxReviews", String(params.maxReviews));
  if (params.minRating !== 4) sp.set("minRating", String(params.minRating));
  if (params.webPresence !== "no") sp.set("webPresence", params.webPresence);
  if (params.page !== 1) sp.set("page", String(params.page));
  if (params.pageSize !== 50) sp.set("pageSize", String(params.pageSize));
  if (params.contactMin !== undefined)
    sp.set("contactMin", String(params.contactMin));
  if (params.contactMax !== undefined)
    sp.set("contactMax", String(params.contactMax));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
