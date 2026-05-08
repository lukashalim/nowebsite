import type { BusinessLead } from "@/lib/business";
import {
  parseContactEnrichment,
  type ContactEnrichment,
} from "@/lib/contact-enrichment-schema";
import { toFiniteNumber } from "@/lib/demo-enrichment";
import {
  defaultCrmDemoCohortFilters,
  type CrmSearchParams,
} from "@/lib/crm-params";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const CRM_BUSINESS_LIST_COLUMNS =
  "place_id, name, address, city, state, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, contact_count" as const;

const DEMO_CORE_COLUMNS =
  "place_id, name, address, city, state, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, contact_enrichment" as const;

export const DEMO_INDEX_COLUMNS = DEMO_CORE_COLUMNS;

export const DEMO_DETAIL_COLUMNS =
  "place_id, name, address, city, state, postal_code, business_type, main_category, rating, reviews, phone, google_maps_link, facebook_url, contact_enrichment, latitude, longitude, is_spending_on_ads, competitive_weakness, review_highlights, services_offered, hours, open_now" as const;

const BATCH = 1000;

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

export interface DemoReviewHighlight {
  rating?: number;
  excerpt: string;
  relative_time?: string;
  reviewer_name?: string;
}

export interface DemoBusinessHour {
  day: string;
  opens?: string;
  closes?: string;
  text?: string;
}

function parseReviewHighlights(value: unknown): DemoReviewHighlight[] | null {
  if (!Array.isArray(value)) return null;
  const out: DemoReviewHighlight[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const excerpt =
      typeof row.excerpt === "string" ? row.excerpt.trim() : "";
    if (!excerpt) continue;
    const rating =
      typeof row.rating === "number" && Number.isFinite(row.rating)
        ? row.rating
        : undefined;
    const relative_time =
      typeof row.relative_time === "string" ? row.relative_time : undefined;
    const reviewer_name =
      typeof row.reviewer_name === "string" ? row.reviewer_name.trim() : "";
    out.push({
      excerpt,
      rating,
      relative_time,
      ...(reviewer_name ? { reviewer_name } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

function parseServicesOffered(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
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

function mapRowToDemoBusiness(
  data: Record<string, unknown>,
  detail: boolean,
): DemoBusiness {
  const enrichment = parseContactEnrichment(data.contact_enrichment);
  const b: DemoBusiness = {
    place_id: String(data.place_id ?? ""),
    name: (data.name as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    postal_code: (data.postal_code as string | null) ?? null,
    business_type: (data.business_type as string | null) ?? null,
    main_category: (data.main_category as string | null) ?? null,
    rating: data.rating != null ? Number(data.rating) : null,
    reviews: data.reviews != null ? Number(data.reviews) : null,
    phone: (data.phone as string | null) ?? null,
    google_maps_link: (data.google_maps_link as string | null) ?? null,
    facebook_url: (data.facebook_url as string | null) ?? null,
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

export async function fetchCrmBusinessRows(
  p: CrmSearchParams,
): Promise<{ rows: BusinessLead[]; total: number; error: string | null }> {
  try {
    const supabase = createSupabaseAdmin();
    let q = supabase
      .from("businesses_nowebsite")
      .select(CRM_BUSINESS_LIST_COLUMNS, { count: "exact" })
      .eq("has_website", p.hasWebsite)
      .neq("contact_count", -1)
      .gte("reviews", p.minReviews)
      .lte("reviews", p.maxReviews)
      .gte("rating", p.minRating);

    if (p.contactMin !== undefined) {
      q = q.gte("contact_count", p.contactMin);
    }
    if (p.contactMax !== undefined) {
      q = q.lte("contact_count", p.contactMax);
    }

    q = applyReviewExcerptsExtractedFilter(q);

    const from = (p.page - 1) * p.pageSize;
    const to = from + p.pageSize - 1;

    const { data, error, count } = await q
      .order("reviews", { ascending: false })
      .range(from, to);

    if (error) {
      return { rows: [], total: 0, error: error.message };
    }
    return {
      rows: (data ?? []) as BusinessLead[],
      total: count ?? 0,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load businesses";
    return { rows: [], total: 0, error: msg };
  }
}

export interface DemoBusiness extends Omit<BusinessLead, "contact_count"> {
  contact_count?: number;
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

/** All `place_id` values in the default CRM demo cohort (for sitemaps). */
export async function fetchAllDemoCohortPlaceIds(): Promise<string[]> {
  const c = defaultCrmDemoCohortFilters();
  const supabase = createSupabaseAdmin();
  const ids: string[] = [];
  let offset = 0;

  for (;;) {
    let q = supabase
      .from("businesses_nowebsite")
      .select("place_id")
      .eq("has_website", c.hasWebsite)
      .neq("contact_count", -1)
      .gte("reviews", c.minReviews)
      .lte("reviews", c.maxReviews)
      .gte("rating", c.minRating);
    q = applyReviewExcerptsExtractedFilter(q);
    const { data, error } = await q
      .order("place_id", { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) {
      throw new Error(error.message);
    }
    const rows = data ?? [];
    for (const row of rows) {
      if (row.place_id) ids.push(row.place_id);
    }
    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  return ids;
}

export async function fetchDemoBusinessByPlaceId(
  placeId: string,
): Promise<DemoBusiness | null> {
  const c = defaultCrmDemoCohortFilters();
  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("businesses_nowebsite")
    .select(DEMO_DETAIL_COLUMNS)
    .eq("has_website", c.hasWebsite)
    .neq("contact_count", -1)
    .gte("reviews", c.minReviews)
    .lte("reviews", c.maxReviews)
    .gte("rating", c.minRating)
    .eq("place_id", placeId);
  q = applyReviewExcerptsExtractedFilter(q);
  const { data, error } = await q.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  const b = mapRowToDemoBusiness(data as Record<string, unknown>, true);
  if (!b.review_highlights?.length) return null;
  return b;
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
    .eq("has_website", c.hasWebsite)
    .neq("contact_count", -1)
    .gte("reviews", c.minReviews)
    .lte("reviews", c.maxReviews)
    .gte("rating", c.minRating);
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
