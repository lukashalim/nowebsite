import "server-only";

import {
  fetchCityListings,
  fetchFacebookDirectoryPageData,
  fetchNationwideCategoryListings,
  fetchStateListings,
} from "@/lib/directory/data";
import {
  fetchGbCityListings,
  fetchGbRegionListings,
} from "@/lib/directory/gb-data";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import type { ListingScope } from "@/lib/directory/listing-scope";
import {
  freeDirectoryCsvRowLimit,
  freeDirectoryExportPageCount,
} from "@/lib/directory-csv-limits";
import type { DirectoryBusiness } from "@/lib/directory/types";

async function fetchScopedPageBusinesses(
  scope: ListingScope,
  page: number,
  pageSize: number,
  filters: DirectoryListingFilters,
): Promise<DirectoryBusiness[]> {
  switch (scope.kind) {
    case "city": {
      const data = await fetchCityListings(scope.slug, { filters });
      return data?.businesses ?? [];
    }
    case "category": {
      const data = await fetchNationwideCategoryListings(scope.slug, {
        page,
        pageSize,
        filters,
      });
      return data?.businesses ?? [];
    }
    case "state": {
      const data = await fetchStateListings(scope.slug, {
        page,
        pageSize,
        filters,
      });
      return data?.businesses ?? [];
    }
    case "facebook": {
      const data = await fetchFacebookDirectoryPageData({
        page,
        pageSize,
        filters,
      });
      return data.businesses;
    }
    case "gb-city": {
      const businesses = await fetchGbCityListings(scope.slug);
      return businesses ?? [];
    }
    case "gb-region": {
      const data = await fetchGbRegionListings(scope.slug);
      return data?.businesses ?? [];
    }
    default:
      return [];
  }
}

export async function fetchDirectoryPageExportBusinesses(
  scope: ListingScope,
  filters: DirectoryListingFilters,
  pageSize: number,
  totalPages: number,
  isPro: boolean,
): Promise<DirectoryBusiness[]> {
  const pagesToFetch = freeDirectoryExportPageCount(totalPages, isPro);
  const rowLimit = isPro ? Number.POSITIVE_INFINITY : freeDirectoryCsvRowLimit(pageSize);

  if (
    scope.kind === "city" ||
    scope.kind === "gb-city" ||
    scope.kind === "gb-region"
  ) {
    const rows = await fetchScopedPageBusinesses(scope, 1, pageSize, filters);
    return rows.slice(0, Number.isFinite(rowLimit) ? rowLimit : rows.length);
  }

  const rows: DirectoryBusiness[] = [];
  for (let page = 1; page <= pagesToFetch; page++) {
    const pageRows = await fetchScopedPageBusinesses(
      scope,
      page,
      pageSize,
      filters,
    );
    rows.push(...pageRows);
    if (rows.length >= rowLimit) break;
  }

  return rows.slice(0, Number.isFinite(rowLimit) ? rowLimit : rows.length);
}
