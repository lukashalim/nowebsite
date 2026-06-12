/** Max listing pages included in a single free directory CSV export. */
export const FREE_DIRECTORY_CSV_MAX_PAGES = 5;

/** @deprecated Use FREE_DIRECTORY_CSV_MAX_PAGES (per-export cap, not monthly). */
export const FREE_MONTHLY_DIRECTORY_CSV_LIMIT = FREE_DIRECTORY_CSV_MAX_PAGES;

export function freeDirectoryExportPageCount(
  totalPages: number,
  isPro: boolean,
): number {
  if (isPro) return Math.max(1, totalPages);
  return Math.min(FREE_DIRECTORY_CSV_MAX_PAGES, Math.max(1, totalPages));
}

export function freeDirectoryCsvRowLimit(pageSize: number): number {
  return pageSize * FREE_DIRECTORY_CSV_MAX_PAGES;
}
