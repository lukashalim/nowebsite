import { createHmac, timingSafeEqual } from "node:crypto";
import type { DirectoryListingFilters } from "@/lib/directory/listing-filters";
import {
  hashListingFilters,
  serializeListingScope,
  type ListingScope,
} from "@/lib/directory/listing-scope";

const TOKEN_TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.LISTING_ACCESS_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LISTING_ACCESS_SECRET is required in production");
    }
    return "dev-listing-access-secret-change-me";
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

interface ListingAccessTokenPayload {
  scope: string;
  page: number;
  filtersHash: string;
  exp: number;
}

export function createListingAccessToken(
  scope: ListingScope,
  page: number,
  filters: DirectoryListingFilters,
): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: ListingAccessTokenPayload = {
    scope: serializeListingScope(scope),
    page,
    filtersHash: hashListingFilters(filters),
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyListingAccessToken(
  token: string,
  scope: ListingScope,
  page: number,
  filters: DirectoryListingFilters,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return false;

  const expected = signPayload(encoded);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

  let payload: ListingAccessTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as ListingAccessTokenPayload;
  } catch {
    return false;
  }

  if (payload.exp < Date.now()) return false;
  if (payload.scope !== serializeListingScope(scope)) return false;
  if (payload.page !== page) return false;
  if (payload.filtersHash !== hashListingFilters(filters)) return false;
  return true;
}
