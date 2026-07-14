/** Max listing pages included in a single free directory CSV export. */
export const FREE_DIRECTORY_CSV_MAX_PAGES = 1;

/**
 * Hard cap for CSV download `pageSize` (one directory page).
 * Matches DIRECTORY_CATEGORY_PAGE_SIZE / DIRECTORY_CITY_PAGE_SIZE.
 */
export const DIRECTORY_CSV_MAX_PAGE_SIZE = 100;

/** @deprecated Use DIRECTORY_CSV_MAX_PAGE_SIZE. */
export const DIRECTORY_CSV_QUERY_PAGE_SIZE_MAX = DIRECTORY_CSV_MAX_PAGE_SIZE;

/** @deprecated Use FREE_DIRECTORY_CSV_MAX_PAGES (per-export cap, not monthly). */
export const FREE_MONTHLY_DIRECTORY_CSV_LIMIT = FREE_DIRECTORY_CSV_MAX_PAGES;

export function clampDirectoryCsvPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return 1;
  return Math.min(Math.floor(pageSize), DIRECTORY_CSV_MAX_PAGE_SIZE);
}

export function freeDirectoryExportPageCount(
  totalPages: number,
  isPro: boolean,
): number {
  if (isPro) return Math.max(1, totalPages);
  return Math.min(FREE_DIRECTORY_CSV_MAX_PAGES, Math.max(1, totalPages));
}

export function freeDirectoryCsvRowLimit(pageSize: number): number {
  return clampDirectoryCsvPageSize(pageSize) * FREE_DIRECTORY_CSV_MAX_PAGES;
}
