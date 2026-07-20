import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Always production — Lob prints and phones must not hit localhost. */
const POSTCARD_SCAN_ORIGIN = "https://www.nowebsitebusinessleads.com";

/** Compact HMAC length (bytes) — enough for marketing attribution, shorter QR. */
const SIG_BYTES = 16;

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

function signBytes(encoded: string, bytes: number = SIG_BYTES): string {
  return createHmac("sha256", getSecret())
    .update(encoded)
    .digest()
    .subarray(0, bytes)
    .toString("base64url");
}

/** Full-length HMAC used by legacy JSON tokens already printed. */
function signLegacy(encoded: string): string {
  return createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

function safeEqualB64(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Compact v1 body: userId|placeId|username|slug|0|1
 * Shorter than JSON → denser QR modules → more reliable Lob print scans.
 */
function encodeCompactBody(payload: PostcardScanPayload): string {
  const parts = [
    payload.userId.trim(),
    payload.placeId.trim(),
    payload.username.trim(),
    payload.slug.trim(),
    payload.isTest ? "1" : "0",
  ];
  if (parts.some((p) => p.includes("|"))) {
    throw new Error("Postcard scan fields must not contain '|'");
  }
  return Buffer.from(parts.join("|"), "utf8").toString("base64url");
}

function decodeCompactBody(encoded: string): PostcardScanPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 5) return null;
    const [userId, placeId, username, slug, flag] = parts;
    if (!userId?.trim() || !placeId?.trim() || !username?.trim() || !slug?.trim()) {
      return null;
    }
    if (flag !== "0" && flag !== "1") return null;
    return {
      userId: userId.trim(),
      placeId: placeId.trim(),
      username: username.trim(),
      slug: slug.trim(),
      isTest: flag === "1",
    };
  } catch {
    return null;
  }
}

export function createPostcardScanToken(payload: PostcardScanPayload): string {
  const body: PostcardScanPayload = {
    userId: payload.userId.trim(),
    placeId: payload.placeId.trim(),
    username: payload.username.trim(),
    slug: payload.slug.trim(),
    isTest: Boolean(payload.isTest),
  };
  const encoded = encodeCompactBody(body);
  return `1.${encoded}.${signBytes(encoded)}`;
}

/**
 * Phones/QR apps sometimes mangle query strings (spaces, over-encoding).
 * Normalize before HMAC verify.
 */
export function normalizeScanToken(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  // Undo one layer of accidental encoding.
  try {
    if (/%[0-9A-Fa-f]{2}/.test(t)) {
      t = decodeURIComponent(t);
    }
  } catch {
    // keep raw
  }
  // Spaces from broken decoders; base64url never uses '+', but legacy might.
  t = t.replace(/ /g, "+");
  return t;
}

function verifyLegacyJsonToken(token: string): PostcardScanPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  if (!safeEqualB64(signature, signLegacy(encoded))) return null;

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

function verifyCompactToken(token: string): PostcardScanPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "1") return null;
  const [, encoded, signature] = parts;
  if (!encoded || !signature) return null;
  if (!safeEqualB64(signature, signBytes(encoded))) return null;
  return decodeCompactBody(encoded);
}

export function verifyPostcardScanToken(
  token: string,
): PostcardScanPayload | null {
  const normalized = normalizeScanToken(token);
  if (!normalized) return null;

  if (normalized.startsWith("1.")) {
    return verifyCompactToken(normalized);
  }
  return verifyLegacyJsonToken(normalized);
}

export function buildPostcardScanUrl(payload: PostcardScanPayload): string {
  const t = createPostcardScanToken(payload);
  // Token is base64url — leave unencoded so scanners don't double-encode.
  return `${POSTCARD_SCAN_ORIGIN}/api/postcard-scan?t=${t}`;
}
