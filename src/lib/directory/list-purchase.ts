import "server-only";

import type Stripe from "stripe";
import {
  fetchCityListings,
  fetchNationwideCategoryListings,
} from "@/lib/directory/data";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import { fetchDirectoryPageExportBusinesses } from "@/lib/directory/page-export";
import {
  DEFAULT_DIRECTORY_LISTING_FILTERS,
  type DirectoryListingFilters,
  parseDirectoryListingFilters,
} from "@/lib/directory/listing-filters";
import type { ListingScope } from "@/lib/directory/listing-scope";
import {
  DIRECTORY_CSV_MAX_PAGE_SIZE,
  freeDirectoryCsvRowLimit,
} from "@/lib/directory-csv-limits";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { totalDirectoryPages } from "@/lib/directory/pagination";
import {
  formatCategoryDisplayName,
  formatCityState,
} from "@/lib/directory/labels";
import { parseCitySlug } from "@/lib/directory/slugs";
import {
  LIST_PURCHASE_EMAIL_ATTACH_MAX_BYTES,
  LIST_PURCHASE_EMAIL_LINK_TTL_SECONDS,
  sendListPurchaseCsvEmail,
} from "@/lib/directory/list-purchase-email";

export const LIST_PURCHASE_TYPE = "full_list";
export const LIST_PURCHASE_BUCKET = "list-purchase-csvs";
export const LIST_PURCHASE_FREE_ROWS = freeDirectoryCsvRowLimit(
  DIRECTORY_CSV_MAX_PAGE_SIZE,
);

export type ListPurchaseStatus = "pending" | "fulfilled" | "failed";

export interface ListPurchaseRow {
  stripe_session_id: string;
  scope_kind: string;
  scope_slug: string;
  filters: DirectoryListingFilters;
  total_rows: number;
  free_rows_given: number;
  status: ListPurchaseStatus;
  storage_path: string | null;
  error_message: string | null;
  created_at: string;
  fulfilled_at: string | null;
}

export interface ListPurchaseMetadata {
  purchase_type: typeof LIST_PURCHASE_TYPE;
  scope_kind: "category" | "city";
  scope_slug: string;
  state_slug: string;
  city_slug: string;
  min_reviews: string;
  total_rows: string;
  free_rows_given: string;
  page_path: string;
}

export function isBuyFullListScope(
  scope: ListingScope,
): scope is ListingScope & { kind: "category" | "city" } {
  return scope.kind === "category" || scope.kind === "city";
}

export async function countDirectoryListRows(
  scope: ListingScope & { kind: "category" | "city" },
  filters: DirectoryListingFilters,
): Promise<number> {
  if (scope.kind === "category") {
    const data = await fetchNationwideCategoryListings(scope.slug, {
      page: 1,
      pageSize: DIRECTORY_CSV_MAX_PAGE_SIZE,
      filters,
    });
    return data?.totalCount ?? 0;
  }
  const data = await fetchCityListings(scope.slug, {
    page: 1,
    pageSize: DIRECTORY_CSV_MAX_PAGE_SIZE,
    filters,
  });
  return data?.totalCount ?? 0;
}

export function buildListPurchaseMetadata(input: {
  scope: ListingScope & { kind: "category" | "city" };
  filters: DirectoryListingFilters;
  totalRows: number;
  pagePath: string;
  freeRowsGiven?: number;
}): ListPurchaseMetadata {
  const freeRows = input.freeRowsGiven ?? LIST_PURCHASE_FREE_ROWS;
  return {
    purchase_type: LIST_PURCHASE_TYPE,
    scope_kind: input.scope.kind,
    scope_slug: input.scope.slug,
    state_slug: input.filters.stateSlug ?? "",
    city_slug: input.filters.citySlug ?? "",
    min_reviews: String(input.filters.minReviews),
    total_rows: String(input.totalRows),
    free_rows_given: String(freeRows),
    page_path: input.pagePath.slice(0, 450),
  };
}

export function parseListPurchaseMetadata(
  metadata: Stripe.Metadata | null | undefined,
): {
  scope: ListingScope & { kind: "category" | "city" };
  filters: DirectoryListingFilters;
  totalRows: number;
  freeRowsGiven: number;
  pagePath: string;
} | null {
  if (!metadata || metadata.purchase_type !== LIST_PURCHASE_TYPE) return null;
  const kind = metadata.scope_kind;
  const slug = metadata.scope_slug?.trim().toLowerCase();
  if ((kind !== "category" && kind !== "city") || !slug) return null;

  const filters = parseDirectoryListingFilters({
    state: metadata.state_slug || undefined,
    city: metadata.city_slug || undefined,
    minReviews: metadata.min_reviews || undefined,
  });

  const totalRows = Number.parseInt(metadata.total_rows ?? "", 10);
  const freeRowsGiven = Number.parseInt(
    metadata.free_rows_given ?? String(LIST_PURCHASE_FREE_ROWS),
    10,
  );
  if (!Number.isFinite(totalRows) || totalRows < 1) return null;

  return {
    scope: { kind, slug },
    filters: {
      ...DEFAULT_DIRECTORY_LISTING_FILTERS,
      ...filters,
    },
    totalRows,
    freeRowsGiven: Number.isFinite(freeRowsGiven)
      ? freeRowsGiven
      : LIST_PURCHASE_FREE_ROWS,
    pagePath: metadata.page_path?.trim() || `/${slug}`,
  };
}

async function fetchRemainingPaidBusinesses(
  scope: ListingScope & { kind: "category" | "city" },
  filters: DirectoryListingFilters,
  totalRows: number,
  freeRowsGiven: number,
) {
  const pageSize = DIRECTORY_CSV_MAX_PAGE_SIZE;
  const totalPages = totalDirectoryPages(totalRows, pageSize);
  const all = await fetchDirectoryPageExportBusinesses(
    scope,
    filters,
    pageSize,
    totalPages,
    true,
  );
  return all.slice(Math.max(0, freeRowsGiven));
}

export async function getListPurchase(
  sessionId: string,
): Promise<ListPurchaseRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("list_purchases")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as ListPurchaseRow;
}

export async function createSignedListPurchaseDownloadUrl(
  storagePath: string,
  expiresInSeconds = 120,
): Promise<string> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(LIST_PURCHASE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create download URL");
  }
  return data.signedUrl;
}

/** Human label for email subject/body from purchase scope + filters. */
export function listPurchaseScopeLabel(
  scope: ListingScope & { kind: "category" | "city" },
  filters: DirectoryListingFilters,
): string {
  if (scope.kind === "category") {
    const category = formatCategoryDisplayName(scope.slug).toLowerCase();
    if (filters.citySlug) {
      const parsed = parseCitySlug(filters.citySlug);
      if (parsed && "stateAbbr" in parsed) {
        const city = titleCaseWords(parsed.cityPattern);
        return `${category} in ${formatCityState(city, parsed.stateAbbr)}`;
      }
      return `${category} in ${formatCategoryDisplayName(filters.citySlug)}`;
    }
    return category;
  }

  const parsed = parseCitySlug(scope.slug);
  if (parsed && "stateAbbr" in parsed) {
    return formatCityState(titleCaseWords(parsed.cityPattern), parsed.stateAbbr);
  }
  return formatCategoryDisplayName(scope.slug);
}

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function buyerEmailFromSession(session: Stripe.Checkout.Session): string | null {
  const fromDetails = session.customer_details?.email?.trim();
  if (fromDetails) return fromDetails;
  const fromCustomerEmail = session.customer_email?.trim();
  if (fromCustomerEmail) return fromCustomerEmail;
  return null;
}

/**
 * Idempotent fulfillment from a paid Checkout Session.
 * Reads scope/filters only from session metadata.
 * Email is best-effort backup after CSV is stored (failures are logged only).
 */
export async function fulfillListPurchaseFromSession(
  session: Stripe.Checkout.Session,
): Promise<ListPurchaseRow> {
  const parsed = parseListPurchaseMetadata(session.metadata);
  if (!parsed) {
    throw new Error("Not a full-list purchase session");
  }

  const sessionId = session.id;
  const existing = await getListPurchase(sessionId);
  if (existing?.status === "fulfilled" && existing.storage_path) {
    return existing;
  }

  const supabase = createSupabaseAdmin();
  const { error: upsertError } = await supabase.from("list_purchases").upsert(
    {
      stripe_session_id: sessionId,
      scope_kind: parsed.scope.kind,
      scope_slug: parsed.scope.slug,
      filters: parsed.filters,
      total_rows: parsed.totalRows,
      free_rows_given: parsed.freeRowsGiven,
      status: existing?.status === "failed" ? "pending" : (existing?.status ?? "pending"),
      storage_path: existing?.storage_path ?? null,
      error_message: null,
    },
    { onConflict: "stripe_session_id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  try {
    const remaining = await fetchRemainingPaidBusinesses(
      parsed.scope,
      parsed.filters,
      parsed.totalRows,
      parsed.freeRowsGiven,
    );
    const csv = buildDirectoryBusinessesCsv(remaining);
    const filename = csvFilenameFromPagePath(parsed.pagePath).replace(
      /\.csv$/i,
      `-remaining.csv`,
    );
    const storagePath = `${sessionId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(LIST_PURCHASE_BUCKET)
      .upload(storagePath, Buffer.from(csv, "utf8"), {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: updated, error: updateError } = await supabase
      .from("list_purchases")
      .update({
        status: "fulfilled",
        storage_path: storagePath,
        error_message: null,
        fulfilled_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", sessionId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to mark purchase fulfilled");
    }

    console.info("[list-purchase] fulfilled", {
      sessionId,
      scope: `${parsed.scope.kind}:${parsed.scope.slug}`,
      remainingRows: remaining.length,
      storagePath,
    });

    // Backup email — never fail fulfillment / webhook on Resend errors.
    try {
      const to = buyerEmailFromSession(session);
      if (!to) {
        console.error(
          "[list-purchase] email skipped: no buyer email on Checkout Session",
          { sessionId },
        );
      } else {
        const scopeLabel = listPurchaseScopeLabel(parsed.scope, parsed.filters);
        const csvBytes = Buffer.byteLength(csv, "utf8");
        let downloadUrl: string | undefined;
        if (csvBytes > LIST_PURCHASE_EMAIL_ATTACH_MAX_BYTES) {
          downloadUrl = await createSignedListPurchaseDownloadUrl(
            storagePath,
            LIST_PURCHASE_EMAIL_LINK_TTL_SECONDS,
          );
        }
        await sendListPurchaseCsvEmail({
          to,
          scopeLabel,
          recordCount: remaining.length,
          filename,
          csvUtf8: csv,
          downloadUrl,
        });
        console.info("[list-purchase] email sent", {
          sessionId,
          to,
          attached: csvBytes <= LIST_PURCHASE_EMAIL_ATTACH_MAX_BYTES,
          recordCount: remaining.length,
        });
      }
    } catch (emailErr) {
      console.error("[list-purchase] email failed (purchase still fulfilled)", {
        sessionId,
        error:
          emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return updated as ListPurchaseRow;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fulfillment failed";
    await supabase
      .from("list_purchases")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
      })
      .eq("stripe_session_id", sessionId)
      .neq("status", "fulfilled");
    throw err;
  }
}
