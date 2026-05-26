export type DirectoryCountry = "US" | "GB";

export interface DirectoryBusiness {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: DirectoryCountry;
  business_type: string | null;
  main_category: string | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  google_maps_link: string | null;
  demo_slug: string | null;
}

export interface DirectoryCityRef {
  citySlug: string;
  city: string;
  state: string;
  country: DirectoryCountry;
  listingCount: number;
  /** Latest `last_scraped_at` or `scraped_at` in this city. */
  lastModifiedAt: string | null;
}

export interface DirectoryCategoryRef {
  categorySlug: string;
  categoryLabel: string;
  listingCount: number;
}

export interface DirectoryCityCategoryRef {
  citySlug: string;
  categorySlug: string;
  city: string;
  state: string;
  categoryLabel: string;
  listingCount: number;
  lastModifiedAt: string | null;
}

export const DIRECTORY_MIN_CITY_LISTINGS = 50;
export const DIRECTORY_MIN_CATEGORY_LISTINGS = 10;
export const DIRECTORY_MIN_STATE_LISTINGS = 10;

/** @deprecated Use DIRECTORY_MIN_CITY_LISTINGS */
export const DIRECTORY_MIN_LISTINGS = DIRECTORY_MIN_CITY_LISTINGS;

export interface DirectoryStateRef {
  stateSlug: string;
  state: string;
  country: DirectoryCountry;
  listingCount: number;
  lastModifiedAt: string | null;
}

export interface DirectoryCityGroup {
  city: string;
  state: string;
  country: DirectoryCountry;
  citySlug: string;
  businesses: DirectoryBusiness[];
}

export interface DirectoryUkRegionRef {
  regionSlug: string;
  region: string;
  listingCount: number;
  lastModifiedAt: string | null;
}

export const DIRECTORY_MIN_UK_REGION_LISTINGS = 10;

export const DIRECTORY_LIST_COLUMNS =
  "name, address, city, state, country, business_type, main_category, rating, reviews, phone, google_maps_link, demo_slug, last_scraped_at, scraped_at" as const;
