import "server-only";

/** Max length for the base "get more … jobs" headline (no owner prefix). */
export const POSTCARD_CALL_HEADLINE_MAX_LENGTH = 40;

/** Full display line budget including optional "Name - " prefix (~2.7in at 14pt). */
export const POSTCARD_CALL_HEADLINE_DISPLAY_MAX_LENGTH = 48;

const DEFAULT_HEADLINE = "get more local jobs";

const ROLE_SUFFIX_PATTERN = /^(contractors?|companies|company|services?|specialists?)$/;
const GENERIC_REMAINDERS = new Set(["general"]);

export interface ParsedPostcardCallHeadline {
  ownerPrefix: string | null;
  prefix: string;
  emphasis: string;
  suffix: string;
}

const CALL_HEADLINE_PATTERN = /^(?:(.+?) - )?get more (.+) jobs$/i;

/** First name for postcard personalization, or null if unavailable. */
export function postcardOwnerFirstName(
  ownerName?: string | null,
): string | null {
  const trimmed = ownerName?.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  if (!first || /[\r\n<>]/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** "Phil - " when a first name is known; empty string otherwise. */
export function postcardOwnerHeadlinePrefix(
  ownerName?: string | null,
): string {
  const first = postcardOwnerFirstName(ownerName);
  return first ? `${first} - ` : "";
}

/** Split a validated headline into optional owner, prefix, job phrase, and suffix. */
export function parsePostcardCallHeadline(
  headline: string,
): ParsedPostcardCallHeadline | null {
  const normalized = normalizeWhitespace(headline);
  const match = CALL_HEADLINE_PATTERN.exec(normalized);
  if (!match?.[2]?.trim()) return null;

  const ownerRaw = match[1]?.trim() || null;
  return {
    ownerPrefix: ownerRaw,
    prefix: "get more ",
    emphasis: match[2].trim(),
    suffix: " jobs",
  };
}

/** Render headline HTML with the job phrase emphasized. */
export function formatPostcardCallHeadlineHtml(
  headline: string,
  ownerName?: string | null,
): string {
  const base = normalizeWhitespace(headline) || DEFAULT_HEADLINE;
  const ownerPrefix = postcardOwnerHeadlinePrefix(ownerName);
  const display = ownerPrefix
    ? `${ownerPrefix}${stripOwnerPrefix(base)}`
    : stripOwnerPrefix(base);
  const normalized = normalizeWhitespace(display) || DEFAULT_HEADLINE;
  const parsed = parsePostcardCallHeadline(normalized);
  if (!parsed) return escapeHeadlineHtml(normalized);

  const ownerHtml = parsed.ownerPrefix
    ? `<span class="headline-emphasis">${escapeHeadlineHtml(parsed.ownerPrefix)}</span> - `
    : "";

  return `${ownerHtml}${escapeHeadlineHtml(parsed.prefix)}<span class="headline-emphasis">${escapeHeadlineHtml(parsed.emphasis)}</span>${escapeHeadlineHtml(parsed.suffix)}`;
}

/** Adaptive letter-spacing to keep 14pt headlines on one line in 2.7in. */
export function headlineTrackingStyle(length: number): string {
  if (length <= 32) return "";
  if (length <= 40) return ' style="letter-spacing:-0.015em"';
  return ' style="letter-spacing:-0.025em"';
}

/**
 * Primary-category job phrase for postcard copy.
 * Lowercases, turns separators into spaces, and strips a trailing role word
 * unless that would leave nothing or a generic remainder like "general".
 */
export function jobPhraseFromCategory(
  category?: string | null,
  businessType?: string | null,
): string {
  const raw =
    normalizeWhitespace(category ?? "") ||
    normalizeWhitespace(businessType ?? "");
  if (!raw) return "local";

  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "local";

  const words = normalized.split(" ");
  const last = words[words.length - 1];
  if (words.length > 1 && last && ROLE_SUFFIX_PATTERN.test(last)) {
    const remainder = words.slice(0, -1).join(" ");
    if (remainder && !GENERIC_REMAINDERS.has(remainder)) {
      return remainder;
    }
  }

  return normalized;
}

/**
 * Postcard front headline from the primary business category.
 * Returns the base "get more … jobs" string (no owner prefix).
 */
export function generatePostcardCallHeadline(input: {
  category?: string | null;
  businessType?: string | null;
  /** When set, shortens the base headline budget so "Name - …" still fits. */
  ownerName?: string | null;
}): string {
  const ownerPrefix = postcardOwnerHeadlinePrefix(input.ownerName);
  const maxBaseLength = Math.max(
    24,
    POSTCARD_CALL_HEADLINE_DISPLAY_MAX_LENGTH - ownerPrefix.length,
  );
  const phrase = jobPhraseFromCategory(input.category, input.businessType);
  return headlineFromPhrase(phrase, maxBaseLength);
}

function headlineFromPhrase(phrase: string, maxLength: number): string {
  const words = phrase.split(" ").filter(Boolean);
  while (words.length > 0) {
    const candidate = `get more ${words.join(" ")} jobs`;
    if (candidate.length <= maxLength && isSafeHeadline(candidate)) {
      return candidate;
    }
    words.shift();
  }
  return DEFAULT_HEADLINE;
}

/** Strip a leading "Name - " if a caller included one. */
function stripOwnerPrefix(headline: string): string {
  const match = /^.+? - (get more .+ jobs)$/i.exec(
    normalizeWhitespace(headline),
  );
  return match?.[1] ?? normalizeWhitespace(headline);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isSafeHeadline(value: string): boolean {
  return !/[\r\n<>]/.test(value);
}

function escapeHeadlineHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
