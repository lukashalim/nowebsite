import type { BusinessLead } from "@/lib/business";
import {
  parseContactEnrichment,
  type ContactEnrichment,
} from "@/lib/contact-enrichment-schema";
import { extractDemoPublicEmail, toFiniteNumber } from "@/lib/demo-enrichment";
import { isCrmStage, type CrmStage } from "@/lib/crm-stage";
import {
  defaultCrmDemoCohortFilters,
  type CrmSearchParams,
  type CrmWebPresence,
} from "@/lib/crm-params";
import { formatCategoryDisplayName } from "@/lib/directory/labels";
import {
  allNamedCategoryGroupSlugs,
  categorySlugsForGroup,
  fetchCategoryGroupTaxonomy,
  type CategoryGroupId,
  type CategoryGroupTaxonomy,
} from "@/lib/directory/category-groups";
import { stateAbbrToDisplayName, stateToAbbr } from "@/lib/directory/slugs";
import {
  type CrmCategoryFilterOption,
  type CrmFilterOptions,
  type CrmStateFilterOption,
  mainCategoryGroupId,
} from "@/lib/crm-filter-options";
export type {
  CrmCategoryFilterOption,
  CrmFilterOption,
  CrmFilterOptions,
  CrmStateFilterOption,
} from "@/lib/crm-filter-options";
export { filterCrmCategoriesByGroup } from "@/lib/crm-filter-options";
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
  "place_id, demo_slug, name, address, city, state, country, postal_code, business_type, main_category, rating, reviews, phone, phone_line_type, google_maps_link, facebook_url, listing_website, crm_contact_surface, contact_enrichment, is_test" as const;

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

export function mapRowToDemoBusiness(
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
    contact_email: null,
    enrichment_email: extractDemoPublicEmail(enrichment),
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
  contact_email: string | null;
}

function parseUserContactStage(raw: unknown): CrmStage {
  if (typeof raw === "string" && isCrmStage(raw)) {
    return raw;
  }
  return "new";
}

function applyPhoneLineTypeFilter<
  T extends {
    eq: (column: string, value: unknown) => T;
    is: (column: string, value: null) => T;
  },
>(q: T, phoneLineType: CrmSearchParams["phoneLineType"]): T {
  switch (phoneLineType) {
    case "all":
      return q;
    case "mobile":
      return q.eq("phone_line_type", "mobile");
    case "landline_or_voip":
      return q.eq("phone_line_type", "landline_or_voip");
    case "unknown":
      return q.eq("phone_line_type", "unknown");
    case "not_checked":
      return q.is("phone_line_type", null);
    default: {
      const _x: never = phoneLineType;
      return _x;
    }
  }
}

function applyOutreachModeFilter<
  T extends {
    not: (column: string, operator: string, value: unknown) => T;
    neq: (column: string, value: unknown) => T;
  },
>(q: T, outreachMode: CrmSearchParams["outreachMode"]): T {
  switch (outreachMode) {
    case "all":
      return q;
    case "call":
    case "text":
      return q.not("phone", "is", null).neq("phone", "");
    case "mail":
      return q
        .not("address", "is", null)
        .neq("address", "")
        .not("city", "is", null)
        .neq("city", "")
        .not("state", "is", null)
        .neq("state", "")
        .not("postal_code", "is", null)
        .neq("postal_code", "");
    default: {
      const _x: never = outreachMode;
      return _x;
    }
  }
}

function applyCategoryGroupFilter<
  T extends {
    in: (column: string, values: string[]) => T;
    or: (filters: string) => T;
    is: (column: string, value: null) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(q: T, categoryGroup: CategoryGroupId, taxonomy: CategoryGroupTaxonomy): T {
  if (categoryGroup === "other") {
    const named = allNamedCategoryGroupSlugs(taxonomy);
    if (named.length === 0) {
      return q;
    }
    return q.or(
      `directory_category_slug.is.null,directory_category_slug.not.in.(${named.join(",")})`,
    );
  }

  const slugs = categorySlugsForGroup(categoryGroup, taxonomy);
  if (slugs.length === 0) {
    return q;
  }
  return q.in("directory_category_slug", slugs);
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
    const taxonomy = await fetchCategoryGroupTaxonomy();
    const supabase = createSupabaseAdmin();

    const { data: userContactsRaw, error: contactsError } = await supabase
      .from("crm_user_contacts")
      .select("place_id, contact_count, stage, owner_name, notes, contact_email")
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
      contact_email:
        typeof row.contact_email === "string" ? row.contact_email : null,
    }));
    const contactMap = new Map(
      userContacts.map((c) => [
        c.place_id,
        {
          contact_count: c.contact_count,
          stage: c.stage,
          owner_name: c.owner_name,
          notes: c.notes,
          contact_email: c.contact_email,
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

    // Off: hide QA rows from live outreach. On: show only test leads (not mixed in).
    q = p.showTestLeads ? q.eq("is_test", true) : q.eq("is_test", false);

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
      const categoryAllowed =
        !p.categoryGroup ||
        mainCategoryGroupId(p.category, taxonomy) === p.categoryGroup;
      if (categoryAllowed) {
        q = q.eq("main_category", p.category);
      }
    }
    if (p.categoryGroup) {
      q = applyCategoryGroupFilter(q, p.categoryGroup, taxonomy);
    }
    if (p.state) {
      q = q.eq("state", p.state);
    }

    if (p.timezones.length > 0) {
      q = q.in("crm_timezone", p.timezones);
    }

    q = applyPhoneLineTypeFilter(q, p.phoneLineType);
    q = applyOutreachModeFilter(q, p.outreachMode);

    // Live cohort requires extracted review excerpts; test leads often skip that pipeline.
    if (!p.showTestLeads) {
      q = applyReviewExcerptsExtractedFilter(q);
    }

    const from = (p.page - 1) * p.pageSize;
    const to = from + p.pageSize - 1;

    const { data, error, count } = await q
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      const hint =
        /crm_contact_surface|listing_website|phone_line_type|crm_timezone|is_test|schema cache/i.test(
          error.message,
        )
          ? " Run scrape/sql migrations in Supabase (e.g. add-listing-website-crm-contact-surface.sql, add-phone-line-type.sql, add-is-test-crm-leads.sql), then refresh."
          : "";
      return { rows: [], total: 0, error: error.message + hint };
    }

    const rows = ((data ?? []) as Omit<
      BusinessLead,
      "contact_count" | "stage" | "owner_name" | "notes" | "contact_email" | "enrichment_email"
    >[]).map((row) => {
      const userContact = contactMap.get(row.place_id);
      const enrichment = parseContactEnrichment(
        (row as { contact_enrichment?: unknown }).contact_enrichment,
      );
      return {
        ...row,
        contact_count: userContact?.contact_count ?? 0,
        stage: userContact?.stage ?? "new",
        owner_name: userContact?.owner_name ?? null,
        notes: userContact?.notes ?? null,
        contact_email: userContact?.contact_email ?? null,
        enrichment_email: extractDemoPublicEmail(enrichment),
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

export const fetchCrmFilterOptions = cache(
  async (): Promise<CrmFilterOptions> => {
    const [rows, taxonomy] = await Promise.all([
      fetchCrmDistinctFilterValues(),
      fetchCategoryGroupTaxonomy(),
    ]);
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
        groupId: mainCategoryGroupId(value, taxonomy),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const states = [...stateSet]
      .filter((value) => stateToAbbr(value) != null)
      .map((value) => ({
        value,
        label: stateAbbrToDisplayName(stateToAbbr(value) ?? value),
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
    .eq("is_invalid", false)
    .eq("is_test", false);

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
    .eq("is_test", false)
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
