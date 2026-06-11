import { z } from "zod";
import type { DemoReviewHighlight } from "@/lib/demo-review-types";
import { deepseekChat } from "@/lib/deepseek";

const ownerNameResponseSchema = z.object({
  owner_name: z.string().nullable(),
});

function titleCaseFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function normalizeOwnerName(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const firstName = trimmed.split(/\s+/)[0] ?? trimmed;
  const capped = titleCaseFirstName(firstName);
  if (capped.length > 100) return capped.slice(0, 100);
  return capped;
}

export async function inferOwnerNameFromReviews(
  businessName: string | null,
  reviews: DemoReviewHighlight[],
): Promise<string | null> {
  const excerpts = reviews
    .map((r) => r.excerpt.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (excerpts.length === 0) return null;

  const businessLine = businessName?.trim()
    ? `Business: "${businessName.trim()}"`
    : "Business: (unknown)";

  const reviewsBlock = excerpts.map((e) => `- "${e}"`).join("\n");

  const systemPrompt = `You extract the business owner's first name from customer review excerpts.
Rules:
- Return the proprietor/owner first name ONLY when a review clearly refers to them (e.g. "Mark and his crew did great work" → Mark).
- Do NOT return reviewer names from metadata or signatures.
- Do NOT guess from the business name alone.
- If uncertain or no clear owner name, return null.
- Respond with JSON only: { "owner_name": "FirstName" } or { "owner_name": null }.`;

  const userPrompt = `${businessLine}
Reviews:
${reviewsBlock}`;

  const content = await deepseekChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 64, temperature: 0.1, jsonObject: true },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const result = ownerNameResponseSchema.safeParse(parsed);
  if (!result.success) return null;

  return normalizeOwnerName(result.data.owner_name);
}
