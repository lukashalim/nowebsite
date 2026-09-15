import {
  ADMIN_COOKIE_NAME,
  canAccessAdmin,
  type AdminAccess,
} from "@/lib/admin/auth";
import { getClientSiteById } from "@/lib/client-sites";

export const REPORT_COOKIE_NAME = "nw_report";
export const REPORT_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SOMERS_SITE_ID = "somers-lawn-tree";

function encoder(): TextEncoder {
  return new TextEncoder();
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return toHex(digest);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder().encode(message),
  );
  return toHex(signature);
}

export function getReportPassword(siteId: string): string | null {
  if (siteId !== SOMERS_SITE_ID) return null;
  const password = process.env.SOMERS_REPORT_PASSWORD?.trim();
  return password ? password : null;
}

export function reportCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure:
      process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/report",
    maxAge: REPORT_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function createReportSessionToken(
  siteId: string,
): Promise<string | null> {
  const password = getReportPassword(siteId);
  if (!password) return null;
  const expiresAt = Date.now() + REPORT_COOKIE_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = await hmacHex(password, `nw_report:${siteId}:${payload}`);
  return `${payload}.${signature}`;
}

export async function verifyReportSessionToken(
  siteId: string,
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const password = getReportPassword(siteId);
  if (!password) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = await hmacHex(password, `nw_report:${siteId}:${payload}`);
  return timingSafeEqual(signature, expected);
}

export async function reportPasswordsMatch(
  siteId: string,
  input: string,
): Promise<boolean> {
  const expected = getReportPassword(siteId);
  if (!expected) return false;
  const [inputHash, expectedHash] = await Promise.all([
    sha256Hex(input),
    sha256Hex(expected),
  ]);
  return timingSafeEqual(inputHash, expectedHash);
}

export async function canAccessClientReport(input: {
  siteId: string;
  host: string | null;
  reportToken: string | undefined;
  adminToken: string | undefined;
}): Promise<AdminAccess> {
  const admin = await canAccessAdmin({
    host: input.host,
    token: input.adminToken,
  });
  if (admin === "allow") return "allow";
  if (await verifyReportSessionToken(input.siteId, input.reportToken)) {
    return "allow";
  }
  if (getReportPassword(input.siteId)) return "login";
  return "not_found";
}

export function reportPath(siteId: string): string {
  return `/report/${siteId}`;
}

export function reportLoginPath(siteId: string): string {
  return `/report/${siteId}/login`;
}

/** Only `/report/{siteId}` (optional trailing query), never login, never protocol-relative. */
export function safeReportNextPath(
  siteId: string,
  raw: string | null | undefined,
): string {
  const fallback = reportPath(siteId);
  if (!raw) return fallback;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith(fallback)) return fallback;
  if (value.startsWith("//") || value.includes("://")) return fallback;
  if (value === reportLoginPath(siteId) || value.startsWith(`${reportLoginPath(siteId)}?`)) {
    return fallback;
  }
  const rest = value.slice(fallback.length);
  if (rest && rest !== "/" && !rest.startsWith("?")) return fallback;
  return value.startsWith(fallback) ? fallback : fallback;
}

export function parseReportPath(pathname: string): {
  siteId: string;
  isLogin: boolean;
  isLogout: boolean;
} | null {
  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segments[0] !== "report" || !segments[1]) return null;
  const siteId = segments[1];
  if (!getClientSiteById(siteId)) return null;
  if (segments.length === 2) {
    return { siteId, isLogin: false, isLogout: false };
  }
  if (segments.length === 3 && segments[2] === "login") {
    return { siteId, isLogin: true, isLogout: false };
  }
  if (segments.length === 3 && segments[2] === "logout") {
    return { siteId, isLogin: false, isLogout: true };
  }
  return null;
}
