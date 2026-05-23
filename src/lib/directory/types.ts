export interface DirectoryBusiness {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
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

export const DIRECTORY_MIN_LISTINGS = 5;

export const DIRECTORY_LIST_COLUMNS =
  "name, address, city, state, business_type, main_category, rating, reviews, phone, google_maps_link, demo_slug, last_scraped_at, scraped_at" as const;
