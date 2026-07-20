import "server-only";

import { z } from "zod";
import { deepseekChat } from "@/lib/deepseek";

export const LOB_COMPANY_MAX_LENGTH = 40;

const responseSchema = z.object({
  company: z.string(),
});

/**
 * Produce a concise, recognizable mailing-label brand.
 * DeepSeek is best-effort; callers always receive a Lob-safe fallback.
 */
export async function shortenCompanyNameForLob(
  businessName: string,
): Promise<string> {
  const original = normalizeWhitespace(businessName);
  if (!original) return "Business";

  try {
    const content = await deepseekChat(
      [
        {
          role: "system",
          content: `Shorten a business name for a postal mailing label.
Rules:
- Return the shortest recognizable brand name, maximum 40 characters.
- Remove legal suffixes such as LLC, Inc, Corp, Ltd, and LLP.
- Remove generic service/category words when the distinctive brand remains clear.
- Preserve meaningful initials, names, acronyms, and words such as "by".
- Do not invent or paraphrase the brand.
- Example: "Shaded by J Window Tinting LLC" becomes "Shaded by J".
- Respond with JSON only: { "company": "Short Brand" }.`,
        },
        {
          role: "user",
          content: `Business name: ${JSON.stringify(original)}`,
        },
      ],
      { maxTokens: 64, temperature: 0, jsonObject: true },
    );

    const parsed = responseSchema.safeParse(JSON.parse(content));
    if (parsed.success) {
      const candidate = normalizeWhitespace(parsed.data.company);
      if (
        candidate &&
        candidate.length <= LOB_COMPANY_MAX_LENGTH &&
        isSafeCompanyName(candidate)
      ) {
        return candidate;
      }
    }
  } catch (error) {
    console.warn("[postcard] DeepSeek company shortening failed", error);
  }

  return fallbackCompanyName(original);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isSafeCompanyName(value: string): boolean {
  return !/[\r\n<>]/.test(value);
}

/** Remove common legal suffixes, then truncate without splitting a word. */
export function fallbackCompanyName(value: string): string {
  const withoutLegalSuffix = normalizeWhitespace(value)
    .replace(
      /(?:,?\s+)(?:LLC|L\.L\.C\.|INC\.?|INCORPORATED|CORP\.?|CORPORATION|LTD\.?|LIMITED|LLP|PLLC)\s*$/i,
      "",
    )
    .trim();
  const source = withoutLegalSuffix || normalizeWhitespace(value) || "Business";
  if (source.length <= LOB_COMPANY_MAX_LENGTH) return source;

  const clipped = source.slice(0, LOB_COMPANY_MAX_LENGTH + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace >= 3) return clipped.slice(0, lastSpace).trim();
  return source.slice(0, LOB_COMPANY_MAX_LENGTH).trim();
}
