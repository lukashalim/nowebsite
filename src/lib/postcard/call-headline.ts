import "server-only";

import { z } from "zod";
import { parseReviewHighlights } from "@/lib/demo-review-types";
import { deepseekChat } from "@/lib/deepseek";

/** Max length for the base "More … calls" headline (no owner prefix). */
export const POSTCARD_CALL_HEADLINE_MAX_LENGTH = 40;

/** Full display line budget including optional "Name - " prefix (~2.7in at 14pt). */
export const POSTCARD_CALL_HEADLINE_DISPLAY_MAX_LENGTH = 48;

export interface ParsedPostcardCallHeadline {
  ownerPrefix: string | null;
  prefix: string;
  emphasis: string;
  suffix: string;
}

const CALL_HEADLINE_PATTERN = /^(?:(.+?) - )?More (.+) calls$/i;

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

/** Split a validated headline into optional owner, prefix, service phrase, and suffix. */
export function parsePostcardCallHeadline(
  headline: string,
): ParsedPostcardCallHeadline | null {
  const normalized = normalizeWhitespace(headline);
  const match = CALL_HEADLINE_PATTERN.exec(normalized);
  if (!match?.[2]?.trim()) return null;

  const ownerRaw = match[1]?.trim() || null;
  return {
    ownerPrefix: ownerRaw,
    prefix: "More ",
    emphasis: match[2].trim(),
    suffix: " calls",
  };
}

/** Render headline HTML with the service phrase emphasized. */
export function formatPostcardCallHeadlineHtml(
  headline: string,
  ownerName?: string | null,
): string {
  const base =
    normalizeWhitespace(headline) || "More local customer calls";
  const ownerPrefix = postcardOwnerHeadlinePrefix(ownerName);
  const display = ownerPrefix
    ? `${ownerPrefix}${stripOwnerPrefix(base)}`
    : stripOwnerPrefix(base);
  const normalized = normalizeWhitespace(display) || "More local customer calls";
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

const responseSchema = z.object({
  headline: z.string(),
});

/**
 * Postcard front headline tailored to the calls a business wants.
 * Specificity is grounded in listed services and review excerpts.
 * DeepSeek is best-effort; callers always receive a Lob-safe fallback.
 * Returns the base "More … calls" string (no owner prefix).
 */
export async function generatePostcardCallHeadline(input: {
  businessName?: string | null;
  category?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;
  servicesOffered?: unknown;
  reviewHighlights?: unknown;
  /** When set, shortens the base headline budget so "Name - …" still fits. */
  ownerName?: string | null;
}): Promise<string> {
  const businessName = normalizeWhitespace(input.businessName ?? "");
  const category = normalizeWhitespace(input.category ?? "");
  const businessType = normalizeWhitespace(input.businessType ?? "");
  const location = [input.city?.trim(), input.state?.trim()].filter(Boolean).join(", ");
  const ownerPrefix = postcardOwnerHeadlinePrefix(input.ownerName);
  const maxBaseLength = Math.max(
    24,
    POSTCARD_CALL_HEADLINE_DISPLAY_MAX_LENGTH - ownerPrefix.length,
  );

  const services = parseServicesOfferedInput(input.servicesOffered).slice(0, 12);
  const reviewExcerpts =
    parseReviewHighlights(input.reviewHighlights)
      ?.map((review) => review.excerpt.trim())
      .filter(Boolean)
      .slice(0, 8) ?? [];

  try {
    const contextLines = [
      businessName ? `Business name: ${JSON.stringify(businessName)}` : null,
      category ? `Category: ${JSON.stringify(category)}` : null,
      businessType ? `Business type: ${JSON.stringify(businessType)}` : null,
      location ? `Location: ${JSON.stringify(location)}` : null,
    ].filter(Boolean);

    const servicesBlock =
      services.length > 0
        ? `\nServices offered:\n${services.map((service) => `- ${JSON.stringify(service)}`).join("\n")}`
        : "";

    const reviewsBlock =
      reviewExcerpts.length > 0
        ? `\nCustomer review excerpts:\n${reviewExcerpts.map((excerpt) => `- ${JSON.stringify(excerpt)}`).join("\n")}`
        : "";

    const content = await deepseekChat(
      [
        {
          role: "system",
          content: `Write a short postcard headline for a local service business.
Rules:
- Format must be exactly: More [service or job type] calls
- Be as specific as the listed services and review excerpts support — never more specific.
- Prefer phrases drawn directly from services offered when they imply phone-call intent.
- Reviews may narrow the phrase only if they mention a service or job plausible from services or category.
- Do NOT invent materials, brands, or sub-jobs (e.g. "metal", "tankless") unless services or reviews explicitly mention them.
- If services are broad (e.g. "Roofing") and reviews mention a sub-task, prefer the sub-task only if it fits under listed services; otherwise stay at the listed service level.
- If data is thin, fall back to category or business type at a similar specificity level.
- Use natural lowercase for the service phrase inside the headline.
- Aim for 2–4 words in the service phrase when possible.
- Maximum ${maxBaseLength} characters total.
- No trailing period. Do not include the business name or an owner name.
- Respond with JSON only: { "headline": "More … calls" }.`,
        },
        {
          role: "user",
          content: `${contextLines.join("\n")}${servicesBlock}${reviewsBlock}`,
        },
      ],
      { maxTokens: 96, temperature: 0.2, jsonObject: true },
    );

    const parsed = responseSchema.safeParse(JSON.parse(content));
    if (parsed.success) {
      const candidate = normalizeHeadline(parsed.data.headline, maxBaseLength);
      if (candidate) return candidate;
    }
  } catch (error) {
    console.warn("[postcard] DeepSeek call headline failed", error);
  }

  return fallbackPostcardCallHeadline({ category, businessType, maxBaseLength });
}

export function fallbackPostcardCallHeadline(input: {
  category?: string | null;
  businessType?: string | null;
  maxBaseLength?: number;
}): string {
  const maxBaseLength =
    input.maxBaseLength ?? POSTCARD_CALL_HEADLINE_MAX_LENGTH;
  const servicePhrase = inferFallbackServicePhrase(
    input.category,
    input.businessType,
  );
  return (
    normalizeHeadline(`More ${servicePhrase} calls`, maxBaseLength) ??
    "More local customer calls"
  );
}

function inferFallbackServicePhrase(
  category?: string | null,
  businessType?: string | null,
): string {
  const raw = normalizeWhitespace(category ?? "") || normalizeWhitespace(businessType ?? "");
  if (!raw) return "local customer";

  const normalized = raw.toLowerCase().replace(/_/g, " ");
  if (normalized.endsWith(" services")) {
    return normalized.replace(/ services$/, "");
  }
  if (normalized.endsWith(" service")) {
    return normalized.replace(/ service$/, "");
  }
  return normalized;
}

function parseServicesOfferedInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !isPlaceholderServicesOfferedLabel(item));
}

function isPlaceholderServicesOfferedLabel(label: string): boolean {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "local cache";
}

/** Strip a leading "Name - " if the model or caller included one. */
function stripOwnerPrefix(headline: string): string {
  const match = /^.+? - (More .+ calls)$/i.exec(normalizeWhitespace(headline));
  return match?.[1] ?? normalizeWhitespace(headline);
}

function normalizeHeadline(
  value: string,
  maxLength: number = POSTCARD_CALL_HEADLINE_MAX_LENGTH,
): string | null {
  const headline = stripOwnerPrefix(value);
  if (!headline || !isSafeHeadline(headline)) return null;
  if (headline.length > maxLength) return null;

  const lower = headline.toLowerCase();
  if (!lower.startsWith("more ") || !lower.endsWith(" calls")) return null;

  return headline;
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
