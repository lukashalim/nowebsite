import type { ListingScopeKind } from "@/lib/directory/listing-scope";

/** Scopes where free users may only reveal contacts on page 1 (≤100 rows). */
const FREE_REVEAL_PAGE1_KINDS = new Set<ListingScopeKind>([
  "category",
  "city",
]);

/**
 * Whether a user may unlock contact fields for a directory listing page.
 * Pro: always. Free: category/city page 1 only; other scopes unrestricted.
 */
export function canRevealDirectoryPageContacts(
  scopeKind: ListingScopeKind,
  page: number,
  isPro: boolean,
): boolean {
  if (isPro) return true;
  if (!FREE_REVEAL_PAGE1_KINDS.has(scopeKind)) return true;
  return page <= 1;
}
