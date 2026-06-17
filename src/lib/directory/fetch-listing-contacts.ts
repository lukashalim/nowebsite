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
import { DEFAULT_DIRECTORY_LISTING_FILTERS } from "@/lib/directory/listing-filters";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import { toContactRows } from "@/lib/directory/contact-fields";
import type { DirectoryContactRow } from "@/lib/directory/contact-fields";
import type { DirectoryBusiness } from "@/lib/directory/types";
import { parseListingScope, type ListingScope } from "@/lib/directory/listing-scope";

export async function fetchDirectoryBusinessesForScope(
  scope: ListingScope,
  page: number,
  filters: DirectoryListingFilters = DEFAULT_DIRECTORY_LISTING_FILTERS,
): Promise<DirectoryBusiness[] | null> {
  switch (scope.kind) {
    case "city": {
      const data = await fetchCityListings(scope.slug, { filters });
      return data ? data.businesses : null;
    }
    case "category": {
      const data = await fetchNationwideCategoryListings(scope.slug, {
        page,
        filters,
      });
      return data ? data.businesses : null;
    }
    case "state": {
      const data = await fetchStateListings(scope.slug, { page, filters });
      return data ? data.businesses : null;
    }
    case "facebook": {
      const data = await fetchFacebookDirectoryPageData({ page, filters });
      return data.businesses;
    }
    case "gb-city": {
      return await fetchGbCityListings(scope.slug);
    }
    case "gb-region": {
      const data = await fetchGbRegionListings(scope.slug);
      return data ? data.businesses : null;
    }
    default:
      return null;
  }
}

export async function fetchDirectoryContactsForScope(
  scope: ListingScope,
  page: number,
  filters: DirectoryListingFilters = DEFAULT_DIRECTORY_LISTING_FILTERS,
): Promise<DirectoryContactRow[] | null> {
  switch (scope.kind) {
    case "city": {
      const data = await fetchCityListings(scope.slug, { filters });
      return data ? toContactRows(data.businesses) : null;
    }
    case "category": {
      const data = await fetchNationwideCategoryListings(scope.slug, {
        page,
        filters,
      });
      return data ? toContactRows(data.businesses) : null;
    }
    case "state": {
      const data = await fetchStateListings(scope.slug, { page, filters });
      return data ? toContactRows(data.businesses) : null;
    }
    case "facebook": {
      const data = await fetchFacebookDirectoryPageData({ page, filters });
      return toContactRows(data.businesses);
    }
    case "gb-city": {
      const businesses = await fetchGbCityListings(scope.slug);
      return businesses ? toContactRows(businesses) : null;
    }
    case "gb-region": {
      const data = await fetchGbRegionListings(scope.slug);
      return data ? toContactRows(data.businesses) : null;
    }
    default:
      return null;
  }
}

export function parseScopeParam(raw: string): ListingScope | null {
  return parseListingScope(raw);
}
