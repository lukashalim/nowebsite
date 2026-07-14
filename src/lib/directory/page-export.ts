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
  clampDirectoryCsvPageSize,
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
  const size = clampDirectoryCsvPageSize(pageSize);

  switch (scope.kind) {
    case "city": {
      const data = await fetchCityListings(scope.slug, {
        page,
        pageSize: size,
        filters,
      });
      return data?.businesses ?? [];
    }
    case "category": {
      const data = await fetchNationwideCategoryListings(scope.slug, {
        page,
        pageSize: size,
        filters,
      });
      return data?.businesses ?? [];
    }
    case "state": {
      const data = await fetchStateListings(scope.slug, {
        page,
        pageSize: size,
        filters,
      });
      return data?.businesses ?? [];
    }
    case "facebook": {
      const data = await fetchFacebookDirectoryPageData({
        page,
        pageSize: size,
        filters,
      });
      return data.businesses;
    }
    case "gb-city": {
      const businesses = await fetchGbCityListings(scope.slug);
      if (!businesses?.length) return [];
      const start = (page - 1) * size;
      return businesses.slice(start, start + size);
    }
    case "gb-region": {
      const data = await fetchGbRegionListings(scope.slug);
      const businesses = data?.businesses ?? [];
      const start = (page - 1) * size;
      return businesses.slice(start, start + size);
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
  const size = clampDirectoryCsvPageSize(pageSize);
  const pagesToFetch = freeDirectoryExportPageCount(totalPages, isPro);
  const rowLimit = isPro
    ? Number.POSITIVE_INFINITY
    : freeDirectoryCsvRowLimit(size);

  const rows: DirectoryBusiness[] = [];
  for (let page = 1; page <= pagesToFetch; page++) {
    const pageRows = await fetchScopedPageBusinesses(
      scope,
      page,
      size,
      filters,
    );
    rows.push(...pageRows);
    if (rows.length >= rowLimit) break;
  }

  return rows.slice(0, Number.isFinite(rowLimit) ? rowLimit : rows.length);
}
