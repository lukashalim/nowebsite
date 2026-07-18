import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Always production — Lob prints and phones must not hit localhost. */
const POSTCARD_SCAN_ORIGIN = "https://www.nowebsitebusinessleads.com";

export interface PostcardScanPayload {
  userId: string;
  placeId: string;
  username: string;
  /** Decoded demo path segment (not URI-encoded). */
  slug: string;
  /** True when Lob test_ API key was used at send time. */
  isTest: boolean;
}

function getSecret(): string {
  const secret =
    process.env.POSTCARD_SCAN_SECRET?.trim() ||
    process.env.LISTING_ACCESS_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "POSTCARD_SCAN_SECRET or LISTING_ACCESS_SECRET is required in production",
      );
    }
    return "dev-postcard-scan-secret-change-me";
  }
  return secret;
}

function signPayload(encoded: string): string {
  return createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

export function createPostcardScanToken(payload: PostcardScanPayload): string {
  const body: PostcardScanPayload = {
    userId: payload.userId.trim(),
    placeId: payload.placeId.trim(),
    username: payload.username.trim(),
    slug: payload.slug.trim(),
    isTest: Boolean(payload.isTest),
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyPostcardScanToken(
  token: string,
): PostcardScanPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<PostcardScanPayload> & { isTest?: boolean };
    if (
      !parsed.userId?.trim() ||
      !parsed.placeId?.trim() ||
      !parsed.username?.trim() ||
      !parsed.slug?.trim()
    ) {
      return null;
    }
    // Tokens printed before isTest existed were all Lob test_ key sends.
    const isTest =
      typeof parsed.isTest === "boolean" ? parsed.isTest : true;
    return {
      userId: parsed.userId.trim(),
      placeId: parsed.placeId.trim(),
      username: parsed.username.trim(),
      slug: parsed.slug.trim(),
      isTest,
    };
  } catch {
    return null;
  }
}

export function buildPostcardScanUrl(payload: PostcardScanPayload): string {
  const t = createPostcardScanToken(payload);
  return `${POSTCARD_SCAN_ORIGIN}/api/postcard-scan?t=${encodeURIComponent(t)}`;
}
