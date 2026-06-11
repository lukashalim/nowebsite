import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import type { DirectoryContactRow } from "@/lib/directory/contact-fields";
import { directoryListingPathWithQuery } from "@/lib/directory/listing-filters";

export async function fetchDirectoryContacts(
  access: DirectoryContactAccess,
): Promise<DirectoryContactRow[]> {
  const params = new URLSearchParams({
    scope: access.scope,
    token: access.token,
    page: String(access.page),
  });
  if (access.filters.stateSlug) {
    params.set("state", access.filters.stateSlug);
  }
  if (access.filters.citySlug) {
    params.set("city", access.filters.citySlug);
  }
  if (access.filters.minReviews > 0) {
    params.set("minReviews", String(access.filters.minReviews));
  }

  const response = await fetch(`/api/directory/contacts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Could not load contact details");
  }
  const data = (await response.json()) as { contacts: DirectoryContactRow[] };
  return data.contacts;
}

export function contactsPathForPage(
  pagePath: string,
  access: DirectoryContactAccess,
): string {
  return directoryListingPathWithQuery(pagePath, {
    page: access.page,
    filters: access.filters,
  });
}
