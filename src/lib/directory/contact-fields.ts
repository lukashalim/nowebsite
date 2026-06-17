import type { DirectoryBusiness } from "@/lib/directory/types";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import { DEFAULT_DIRECTORY_LISTING_FILTERS } from "@/lib/directory/listing-filters";
import {
  serializeListingScope,
  type ListingScope,
} from "@/lib/directory/listing-scope";

export interface DirectoryBusinessPublic
  extends Omit<DirectoryBusiness, "phone" | "google_maps_link" | "address"> {
  phone?: never;
  google_maps_link?: never;
  address?: never;
}

export interface DirectoryContactRow {
  i: number;
  phone: string | null;
  address: string | null;
  google_maps_link: string | null;
}

export interface DirectoryContactAccess {
  scope: string;
  token: string;
  page: number;
  filters: DirectoryListingFilters;
}

export function stripContactFields(
  business: DirectoryBusiness,
): DirectoryBusinessPublic {
  const {
    phone: _phone,
    google_maps_link: _link,
    address: _address,
    ...rest
  } = business;
  return rest;
}

export function stripContactFieldsList(
  businesses: DirectoryBusiness[],
): DirectoryBusinessPublic[] {
  return businesses.map(stripContactFields);
}

export function toContactRows(businesses: DirectoryBusiness[]): DirectoryContactRow[] {
  return businesses.map((b, i) => ({
    i,
    phone: b.phone?.trim() || null,
    address: b.address?.trim() || null,
    google_maps_link: b.google_maps_link?.trim() || null,
  }));
}

export function toContactRow(
  business: DirectoryBusiness,
  rowIndex: number,
): DirectoryContactRow {
  return {
    i: rowIndex,
    phone: business.phone?.trim() || null,
    address: business.address?.trim() || null,
    google_maps_link: business.google_maps_link?.trim() || null,
  };
}

export function buildContactAccess(
  scope: ListingScope,
  token: string,
  page: number,
  filters: DirectoryListingFilters = DEFAULT_DIRECTORY_LISTING_FILTERS,
): DirectoryContactAccess {
  return {
    scope: serializeListingScope(scope),
    token,
    page,
    filters,
  };
}
