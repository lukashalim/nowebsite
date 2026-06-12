import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

const MAX_USERNAME_ATTEMPTS = 20;
const MAX_USERNAME_LENGTH = 32;

function normalizeEmailLocalPart(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  const local = atIndex === -1 ? trimmed : trimmed.slice(0, atIndex);
  const plusIndex = local.indexOf("+");
  return plusIndex === -1 ? local : local.slice(0, plusIndex);
}

function sanitizeUsernameBase(raw: string): string {
  let base = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/[-_]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  if (!/^[a-z0-9]/.test(base)) {
    base = `u${base}`;
  }

  if (base.length < 3) {
    base = base.padEnd(3, "0");
  }

  if (base.length > MAX_USERNAME_LENGTH) {
    base = base.slice(0, MAX_USERNAME_LENGTH).replace(/[-_]$/, "");
  }

  if (base.length < 3) {
    base = base.padEnd(3, "0");
  }

  return base;
}

export function suggestUsernameFromEmail(email: string): string {
  const local = normalizeEmailLocalPart(email);
  if (!local) {
    return "user000";
  }
  return sanitizeUsernameBase(local);
}

function usernameCandidate(base: string, attempt: number): string {
  if (attempt <= 1) {
    return base.slice(0, MAX_USERNAME_LENGTH);
  }

  const suffix = String(attempt);
  const maxBaseLength = MAX_USERNAME_LENGTH - suffix.length;
  const truncatedBase = base.slice(0, Math.max(1, maxBaseLength)).replace(/[-_]$/, "");
  return `${truncatedBase}${suffix}`.slice(0, MAX_USERNAME_LENGTH);
}

function isUniqueUsernameViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" &&
    (error.message?.includes("username") ?? false)
  );
}

export async function ensureProfileUsername(
  userId: string,
  email: string,
): Promise<string | null> {
  const admin = createSupabaseAdmin();

  const { data: profile, error: fetchError } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    return null;
  }

  const existing = profile?.username?.trim();
  if (existing) {
    return existing;
  }

  const base = suggestUsernameFromEmail(email);
  if (!USERNAME_PATTERN.test(base)) {
    return null;
  }

  for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const candidate = usernameCandidate(base, attempt);
    if (!USERNAME_PATTERN.test(candidate)) {
      continue;
    }

    const { data: updated, error } = await admin
      .from("profiles")
      .update({
        username: candidate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .is("username", null)
      .select("username")
      .maybeSingle();

    if (error) {
      if (isUniqueUsernameViolation(error)) {
        continue;
      }
      return null;
    }

    const username = updated?.username?.trim();
    if (username) {
      return username;
    }

    const { data: refreshed } = await admin
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    const concurrent = refreshed?.username?.trim();
    if (concurrent) {
      return concurrent;
    }
  }

  return null;
}
