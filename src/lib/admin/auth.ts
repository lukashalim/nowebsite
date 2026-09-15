import { isLocalAdminEnabled } from "@/lib/local-admin";

export const ADMIN_COOKIE_NAME = "nw_admin";
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type AdminAccess = "allow" | "login" | "not_found";

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

export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password ? password : null;
}

export function adminCookieOptions(): {
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
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function createAdminSessionToken(): Promise<string | null> {
  const password = getAdminPassword();
  if (!password) return null;
  const expiresAt = Date.now() + ADMIN_COOKIE_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = await hmacHex(password, `nw_admin:${payload}`);
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const password = getAdminPassword();
  if (!password) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = await hmacHex(password, `nw_admin:${payload}`);
  return timingSafeEqual(signature, expected);
}

export async function adminPasswordsMatch(input: string): Promise<boolean> {
  const expected = getAdminPassword();
  if (!expected) return false;
  const [inputHash, expectedHash] = await Promise.all([
    sha256Hex(input),
    sha256Hex(expected),
  ]);
  return timingSafeEqual(inputHash, expectedHash);
}

export async function canAccessAdmin(input: {
  host: string | null;
  token: string | undefined;
}): Promise<AdminAccess> {
  if (await verifyAdminSessionToken(input.token)) return "allow";
  if (isLocalAdminEnabled(input.host)) return "allow";
  if (getAdminPassword()) return "login";
  return "not_found";
}

/** Only `/admin/...` paths, never `/admin/login`, never protocol-relative. */
export function safeAdminNextPath(raw: string | null | undefined): string {
  if (!raw) return "/admin/purchases";
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return "/admin/purchases";
  }
  if (!value.startsWith("/admin")) return "/admin/purchases";
  if (value.startsWith("//") || value.includes("://")) return "/admin/purchases";
  if (value === "/admin/login" || value.startsWith("/admin/login?")) {
    return "/admin/purchases";
  }
  return value;
}
