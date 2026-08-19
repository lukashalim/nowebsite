import "server-only";

import { z } from "zod";
import { parseReviewHighlights } from "@/lib/demo-review-types";
import { deepseekChat } from "@/lib/deepseek";

export const POSTCARD_CALL_HEADLINE_MAX_LENGTH = 52;

const responseSchema = z.object({
  headline: z.string(),
});

/**
 * Postcard front headline tailored to the calls a business wants.
 * DeepSeek is best-effort; callers always receive a Lob-safe fallback.
 */
export async function generatePostcardCallHeadline(input: {
  businessName?: string | null;
  category?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;
  reviewHighlights?: unknown;
}): Promise<string> {
  const businessName = normalizeWhitespace(input.businessName ?? "");
  const category = normalizeWhitespace(input.category ?? "");
  const businessType = normalizeWhitespace(input.businessType ?? "");
  const location = [input.city?.trim(), input.state?.trim()].filter(Boolean).join(", ");

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
- Format must be exactly: Get more [specific service or job type] calls
- Infer the highest-value phone-call job type this business likely wants from category, business type, name, and reviews.
- Be specific when possible (e.g. plumber → "Get more water heater replacement calls", not "Get more plumbing calls").
- Use natural lowercase for the service phrase inside the headline.
- Maximum ${POSTCARD_CALL_HEADLINE_MAX_LENGTH} characters total.
- No trailing period. Do not include the business name.
- Respond with JSON only: { "headline": "Get more … calls" }.`,
        },
        {
          role: "user",
          content: `${contextLines.join("\n")}${reviewsBlock}`,
        },
      ],
      { maxTokens: 96, temperature: 0.2, jsonObject: true },
    );

    const parsed = responseSchema.safeParse(JSON.parse(content));
    if (parsed.success) {
      const candidate = normalizeHeadline(parsed.data.headline);
      if (candidate) return candidate;
    }
  } catch (error) {
    console.warn("[postcard] DeepSeek call headline failed", error);
  }

  return fallbackPostcardCallHeadline({ category, businessType });
}

export function fallbackPostcardCallHeadline(input: {
  category?: string | null;
  businessType?: string | null;
}): string {
  const servicePhrase = inferFallbackServicePhrase(
    input.category,
    input.businessType,
  );
  return normalizeHeadline(`Get more ${servicePhrase} calls`) ?? "Get more local customer calls";
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

function normalizeHeadline(value: string): string | null {
  const headline = normalizeWhitespace(value);
  if (!headline || !isSafeHeadline(headline)) return null;
  if (headline.length > POSTCARD_CALL_HEADLINE_MAX_LENGTH) return null;

  const lower = headline.toLowerCase();
  if (!lower.startsWith("get more ") || !lower.endsWith(" calls")) return null;

  return headline;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isSafeHeadline(value: string): boolean {
  return !/[\r\n<>]/.test(value);
}
