import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import { directoryListingPathWithQuery } from "@/lib/directory/listing-filters";

/** Listings per page on nationwide category hubs (keeps ISR payloads under Vercel limits). */
export const DIRECTORY_CATEGORY_PAGE_SIZE = 100;

/** Listings per page on US state directory hubs. */
export const DIRECTORY_STATE_PAGE_SIZE = 100;

/** Listings per page on the Facebook outreach hub. */
export const DIRECTORY_FACEBOOK_PAGE_SIZE = 100;

export function parseDirectoryPageParam(
  raw: string | string[] | undefined,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) return 1;
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function clampDirectoryPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

export function totalDirectoryPages(
  totalCount: number,
  pageSize: number,
): number {
  if (totalCount <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function directoryPageRange(
  page: number,
  pageSize: number,
  totalCount: number,
): { start: number; end: number } {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return { start, end };
}

/** Build page numbers for pagination controls (with ellipsis gaps as null). */
export function directoryPaginationItems(
  current: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  if (current > 3) items.push("ellipsis");
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);
  for (let p = windowStart; p <= windowEnd; p++) items.push(p);
  if (current < totalPages - 2) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

export function categoryPathWithPage(
  categorySlug: string,
  page: number,
  filters?: DirectoryListingFilters,
): string {
  const base = `/${categorySlug.trim().toLowerCase()}`;
  return directoryListingPathWithQuery(base, { page, filters });
}

export function statePathWithPage(
  stateSlug: string,
  page: number,
  filters?: DirectoryListingFilters,
): string {
  const base = `/${stateSlug.trim().toLowerCase()}`;
  return directoryListingPathWithQuery(base, { page, filters });
}

export function facebookPathWithPage(
  page: number,
  filters?: DirectoryListingFilters,
): string {
  return directoryListingPathWithQuery("/facebook", { page, filters });
}

export function cityPathWithQuery(
  citySlug: string,
  filters?: DirectoryListingFilters,
): string {
  const base = `/${citySlug.trim().toLowerCase()}`;
  return directoryListingPathWithQuery(base, { filters });
}
