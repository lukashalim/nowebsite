import type { BusinessLead } from "@/lib/business";
import {
  parseContactEnrichment,
  type ContactEnrichment,
} from "@/lib/contact-enrichment-schema";
import { toFiniteNumber } from "@/lib/demo-enrichment";
import { isCrmStage, type CrmStage } from "@/lib/crm-stage";
import {
  defaultCrmDemoCohortFilters,
  type CrmSearchParams,
  type CrmWebPresence,
} from "@/lib/crm-params";
import { formatCategoryDisplayName } from "@/lib/directory/labels";
import { stateAbbrToDisplayName } from "@/lib/directory/slugs";
import { fetchCrmDistinctFilterValues } from "@/lib/directory/aggregate-queries";
import {
  parseReviewHighlights,
  type DemoReviewHighlight,
} from "@/lib/demo-review-types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { demoPublicPath, isLikelyGooglePlaceId } from "@/lib/demo-slug";
import { cache } from "react";

export type { DemoReviewHighlight } from "@/lib/demo-review-types";

export const CRM_BUSINESS_LIST_COLUMNS =
  "place_id, demo_slug, name, address, city, state, country, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, listing_website, crm_contact_surface" as const;

const DEMO_CORE_COLUMNS =
  "place_id, demo_slug, name, address, city, state, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, listing_website, crm_contact_surface, contact_enrichment" as const;

export const DEMO_INDEX_COLUMNS = DEMO_CORE_COLUMNS;

export const DEMO_DETAIL_COLUMNS =
  "place_id, demo_slug, name, address, city, state, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, contact_enrichment, latitude, longitude, is_spending_on_ads, competitive_weakness, review_highlights, services_offered, hours, open_now" as const;

const BATCH = 1000;

function normalizeDemoUrlSegment(segment: string): string {
  const t = segment.trim();
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

function applyWebPresenceFilter<
  T extends { eq: (column: string, value: unknown) => T },
>(q: T, webPresence: CrmWebPresence): T {
  switch (webPresence) {
    case "yes":
      return q.eq("has_website", true);
    case "all":
    case "no":
      return q.eq("has_website", false);
    case "plain":
      return q.eq("has_website", false).eq("crm_contact_surface", "none");
    case "facebook":
      return q.eq("has_website", false).eq("crm_contact_surface", "facebook");
    case "whatsapp":
      return q.eq("has_website", false).eq("crm_contact_surface", "whatsapp");
    default: {
      const _x: never = webPresence;
      return _x;
    }
  }
}

/** Only businesses with GMaps review excerpts persisted (see pipeline `review_highlights`). */
function applyReviewExcerptsExtractedFilter<
  T extends {
    not: (column: string, operator: string, value: unknown) => T;
  },
>(q: T): T {
  return q
    .not("review_highlights->0", "is", null)
    .not("review_highlights->0->excerpt", "is", null) as T;
}

export interface DemoBusinessHour {
  day: string;
  opens?: string;
  closes?: string;
  text?: string;
}

/** Synthetic scrape placeholder for business_type — not a customer-facing service. */
function isPlaceholderServicesOfferedLabel(label: string): boolean {
  const t = label
    .trim()
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t === "local cache";
}

function parseServicesOffered(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !isPlaceholderServicesOfferedLabel(x));
  return out.length > 0 ? out : null;
}

function parseHours(value: unknown): DemoBusinessHour[] | null {
  if (!Array.isArray(value)) return null;

  const out: DemoBusinessHour[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const day = typeof row.day === "string" ? row.day.trim() : "";
    const opens = typeof row.opens === "string" ? row.opens.trim() : "";
    const closes = typeof row.closes === "string" ? row.closes.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!day && !text) continue;
    out.push({
      day: day || "Hours",
      ...(opens ? { opens } : {}),
      ...(closes ? { closes } : {}),
      ...(text ? { text } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

function parseCrmContactSurface(
  raw: unknown,
): "facebook" | "whatsapp" | "none" | null {
  if (raw === "facebook" || raw === "whatsapp" || raw === "none") {
    return raw;
  }
  return null;
}

function mapRowToDemoBusiness(
  data: Record<string, unknown>,
  detail: boolean,
): DemoBusiness {
  const enrichment = parseContactEnrichment(data.contact_enrichment);
  const slugRaw = data.demo_slug;
  const demo_slug =
    typeof slugRaw === "string" && slugRaw.trim()
      ? slugRaw.trim().toLowerCase()
      : null;
  const b: DemoBusiness = {
    place_id: String(data.place_id ?? ""),
    demo_slug,
    name: (data.name as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    postal_code: (data.postal_code as string | null) ?? null,
    country:
      data.country === "GB"
        ? "GB"
        : data.country === "AU"
          ? "AU"
          : data.country === "US"
            ? "US"
            : "US",
    business_type: (data.business_type as string | null) ?? null,
    main_category: (data.main_category as string | null) ?? null,
    rating: data.rating != null ? Number(data.rating) : null,
    reviews: data.reviews != null ? Number(data.reviews) : null,
    phone: (data.phone as string | null) ?? null,
    google_maps_link: (data.google_maps_link as string | null) ?? null,
    facebook_url: (data.facebook_url as string | null) ?? null,
    listing_website: (data.listing_website as string | null) ?? null,
    crm_contact_surface: parseCrmContactSurface(data.crm_contact_surface),
    enrichment,
  };
  if (detail) {
    b.latitude = toFiniteNumber(data.latitude);
    b.longitude = toFiniteNumber(data.longitude);
    b.is_spending_on_ads =
      typeof data.is_spending_on_ads === "boolean"
        ? data.is_spending_on_ads
        : null;
    b.competitive_weakness =
      typeof data.competitive_weakness === "string"
        ? data.competitive_weakness
        : null;
    b.review_highlights = parseReviewHighlights(data.review_highlights);
    b.services_offered = parseServicesOffered(data.services_offered);
    b.hours = parseHours(data.hours);
    b.open_now = typeof data.open_now === "boolean" ? data.open_now : null;
  }
  return b;
}

interface UserContactRow {
  place_id: string;
  contact_count: number;
  stage: CrmStage;
  owner_name: string | null;
  notes: string | null;
}

function parseUserContactStage(raw: unknown): CrmStage {
  if (typeof raw === "string" && isCrmStage(raw)) {
    return raw;
  }
  return "new";
}

function applyStageFilter<
  T extends {
    in: (column: string, values: string[]) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(q: T, userContacts: UserContactRow[], stage: CrmStage | undefined): T | null {
  if (stage === undefined) {
    return q;
  }

  if (stage === "new") {
    const excludePlaceIds = userContacts
      .filter((c) => c.stage !== "new")
      .map((c) => c.place_id);
    if (excludePlaceIds.length > 0) {
      q = q.not("place_id", "in", `(${excludePlaceIds.join(",")})`);
    }
    return q;
  }

  const matchingPlaceIds = userContacts
    .filter((c) => c.stage === stage)
    .map((c) => c.place_id);
  if (matchingPlaceIds.length === 0) {
    return null;
  }
  return q.in("place_id", matchingPlaceIds);
}

function applyUserContactFilters<
  T extends {
    in: (column: string, values: string[]) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(q: T, userContacts: UserContactRow[], p: CrmSearchParams): T | null {
  const { contactMin, contactMax } = p;

  if (contactMin !== undefined && contactMin > 0) {
    let minPlaceIds = userContacts
      .filter((c) => c.contact_count >= contactMin)
      .map((c) => c.place_id);
    if (contactMax !== undefined) {
      minPlaceIds = minPlaceIds.filter((id) => {
        const count =
          userContacts.find((c) => c.place_id === id)?.contact_count ?? 0;
        return count <= contactMax;
      });
    }
    if (minPlaceIds.length === 0) {
      return null;
    }
    q = q.in("place_id", minPlaceIds);
  }

  if (contactMax !== undefined) {
    const maxExcludePlaceIds = userContacts
      .filter((c) => c.contact_count > contactMax)
      .map((c) => c.place_id);
    if (maxExcludePlaceIds.length > 0) {
      q = q.not("place_id", "in", `(${maxExcludePlaceIds.join(",")})`);
    }
  }

  return q;
}

export async function fetchCrmBusinessRows(
  p: CrmSearchParams,
  userId: string,
): Promise<{ rows: BusinessLead[]; total: number; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();

    const { data: userContactsRaw, error: contactsError } = await supabase
      .from("crm_user_contacts")
      .select("place_id, contact_count, stage, owner_name, notes")
      .eq("user_id", userId);

    if (contactsError) {
      const hint = /crm_user_contacts|schema cache/i.test(contactsError.message)
        ? " Run scrape/sql/create-crm-user-contacts.sql in Supabase, then refresh."
        : "";
      return { rows: [], total: 0, error: contactsError.message + hint };
    }

    const userContacts: UserContactRow[] = (userContactsRaw ?? []).map((row) => ({
      place_id: String(row.place_id),
      contact_count: Number(row.contact_count) || 0,
      stage: parseUserContactStage(row.stage),
      owner_name:
        typeof row.owner_name === "string" ? row.owner_name : null,
      notes: typeof row.notes === "string" ? row.notes : null,
    }));
    const contactMap = new Map(
      userContacts.map((c) => [
        c.place_id,
        {
          contact_count: c.contact_count,
          stage: c.stage,
          owner_name: c.owner_name,
          notes: c.notes,
        },
      ]),
    );

    let q = supabase
      .from("businesses_nowebsite")
      .select(CRM_BUSINESS_LIST_COLUMNS, { count: "exact" })
      .eq("is_invalid", false)
      .gte("reviews", p.minReviews)
      .lte("reviews", p.maxReviews)
      .gte("rating", p.minRating);

    q = applyWebPresenceFilter(q, p.webPresence);

    const filtered = applyUserContactFilters(q, userContacts, p);
    if (filtered === null) {
      return { rows: [], total: 0, error: null };
    }
    q = filtered;

    const stageFiltered = applyStageFilter(q, userContacts, p.stage);
    if (stageFiltered === null) {
      return { rows: [], total: 0, error: null };
    }
    q = stageFiltered;

    if (p.category) {
      q = q.eq("main_category", p.category);
    }
    if (p.state) {
      q = q.eq("state", p.state);
    }

    q = applyReviewExcerptsExtractedFilter(q);

    const from = (p.page - 1) * p.pageSize;
    const to = from + p.pageSize - 1;

    const { data, error, count } = await q
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      const hint =
        /crm_contact_surface|listing_website|schema cache/i.test(error.message)
          ? " Run scrape/sql/add-listing-website-crm-contact-surface.sql in Supabase, then refresh."
          : "";
      return { rows: [], total: 0, error: error.message + hint };
    }

    const rows = ((data ?? []) as Omit<
      BusinessLead,
      "contact_count" | "stage" | "owner_name" | "notes"
    >[]).map((row) => {
      const userContact = contactMap.get(row.place_id);
      return {
        ...row,
        contact_count: userContact?.contact_count ?? 0,
        stage: userContact?.stage ?? "new",
        owner_name: userContact?.owner_name ?? null,
        notes: userContact?.notes ?? null,
      };
    }) as BusinessLead[];

    return {
      rows,
      total: count ?? 0,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load businesses";
    return { rows: [], total: 0, error: msg };
  }
}

export interface CrmFilterOption {
  value: string;
  label: string;
}

export interface CrmFilterOptions {
  categories: CrmFilterOption[];
  states: CrmFilterOption[];
}

export const fetchCrmFilterOptions = cache(
  async (): Promise<CrmFilterOptions> => {
    const rows = await fetchCrmDistinctFilterValues();
    const categorySet = new Set<string>();
    const stateSet = new Set<string>();

    for (const row of rows) {
      if (row.main_category) categorySet.add(row.main_category);
      if (row.state) stateSet.add(row.state);
    }

    const categories = [...categorySet]
      .map((value) => ({
        value,
        label: formatCategoryDisplayName(value),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const states = [...stateSet]
      .map((value) => ({
        value,
        label: stateAbbrToDisplayName(value),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { categories, states };
  },
);

export interface DemoBusiness
  extends Omit<BusinessLead, "contact_count" | "stage" | "owner_name" | "notes"> {
  contact_count?: number;
  stage?: CrmStage;
  owner_name?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_spending_on_ads?: boolean | null;
  competitive_weakness?: string | null;
  review_highlights?: DemoReviewHighlight[] | null;
  services_offered?: string[] | null;
  hours?: DemoBusinessHour[] | null;
  open_now?: boolean | null;
  enrichment?: ContactEnrichment | null;
}

/**
 * Load a demo detail row by URL segment: Google `place_id` (legacy) or `demo_slug`.
 * Intentionally avoids demo-cohort filters so shared links keep working.
 */
export async function fetchDemoBusinessByUrlSegment(
  segment: string,
): Promise<DemoBusiness | null> {
  const raw = normalizeDemoUrlSegment(segment);
  if (!raw) return null;

  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("businesses_nowebsite")
    .select(DEMO_DETAIL_COLUMNS)
    .eq("is_invalid", false);

  if (isLikelyGooglePlaceId(raw)) {
    q = q.eq("place_id", raw);
  } else {
    q = q.eq("demo_slug", raw.toLowerCase());
  }

  const { data, error } = await q.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRowToDemoBusiness(data as Record<string, unknown>, true);
}

/** Paginated list for `/demo` index (default cohort). */
export async function fetchDemoCohortPage(
  page: number,
  pageSize: number,
): Promise<{ rows: DemoBusiness[]; total: number }> {
  const c = defaultCrmDemoCohortFilters();
  const supabase = createSupabaseAdmin();
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  let q = supabase
    .from("businesses_nowebsite")
    .select(DEMO_INDEX_COLUMNS, { count: "exact" })
    .eq("is_invalid", false)
    .gte("reviews", c.minReviews)
    .lte("reviews", c.maxReviews)
    .gte("rating", c.minRating);
  q = applyWebPresenceFilter(q, c.webPresence);
  q = applyReviewExcerptsExtractedFilter(q);
  const { data, error, count } = await q
    .order("reviews", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) =>
    mapRowToDemoBusiness(row as Record<string, unknown>, false),
  );

  return {
    rows,
    total: count ?? 0,
  };
}

export function demoCohortTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
