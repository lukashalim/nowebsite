import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { clampDirectoryCsvPageSize } from "@/lib/directory-csv-limits";

export function buildDirectoryCsvDownloadUrl(params: {
  exportAccess: DirectoryContactAccess;
  pagePath: string;
  pageSize: number;
  totalPages: number;
}): string {
  const { exportAccess, pagePath, pageSize, totalPages } = params;
  const sp = new URLSearchParams({
    scope: exportAccess.scope,
    token: exportAccess.token,
    pageSize: String(clampDirectoryCsvPageSize(pageSize)),
    totalPages: String(totalPages),
    pageUrl: pagePath,
  });

  if (exportAccess.filters.stateSlug) {
    sp.set("state", exportAccess.filters.stateSlug);
  }
  if (exportAccess.filters.citySlug) {
    sp.set("city", exportAccess.filters.citySlug);
  }
  if (exportAccess.filters.minReviews > 0) {
    sp.set("minReviews", String(exportAccess.filters.minReviews));
  }

  return `/api/csv-download?${sp.toString()}`;
}
