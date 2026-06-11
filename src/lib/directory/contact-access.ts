import { buildContactAccess } from "@/lib/directory/contact-fields";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { createListingAccessToken } from "@/lib/directory/listing-access-token";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import type { ListingScope } from "@/lib/directory/listing-scope";

export function createDirectoryContactAccess(
  scope: ListingScope,
  page: number,
  filters: DirectoryListingFilters,
): DirectoryContactAccess {
  const token = createListingAccessToken(scope, page, filters);
  return buildContactAccess(scope, token, page, filters);
}
