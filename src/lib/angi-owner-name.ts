import { z } from "zod";

const ownerNameResponseSchema = z.object({
  owner_name: z.string().nullable(),
});

function titleCaseFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function normalizeAngiOwnerName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const blocked = new Set([
    "involved",
    "licensed",
    "insured",
    "professional",
    "experienced",
    "certified",
  ]);
  if (blocked.has(trimmed.toLowerCase())) return null;
  const firstName = trimmed.split(/\s+/)[0] ?? trimmed;
  const capped = titleCaseFirstName(firstName);
  if (capped.length > 100) return capped.slice(0, 100);
  return capped;
}

const OWNER_REGEXES: RegExp[] = [
  /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?),?\s+(?:the\s+)?owner\b/i,
  /\bi'?m\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?),?\s+(?:the\s+)?owner\b/i,
  /\bi am\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?),?\s+(?:the\s+)?owner\b/i,
  /\b(?:the\s+)?owner(?:'s name)? is\s+([A-Za-z][A-Za-z'-]+)\b/i,
  /\bowned and operated by\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?)/i,
  /\bfounded by\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+)?)/i,
  /\bpresident(?:\s+is|:)\s+([A-Za-z][A-Za-z'-]+)\b/i,
];

/** Fast path: pull owner first name from Angi "About us" copy via common phrases. */
export function extractOwnerNameFromAngiAboutUsRegex(
  aboutUs: string | null | undefined,
): string | null {
  const text = aboutUs?.trim();
  if (!text) return null;

  for (const re of OWNER_REGEXES) {
    const match = text.match(re);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return normalizeAngiOwnerName(candidate);
    }
  }
  return null;
}

async function deepseekOwnerFromAboutUs(
  businessName: string | null | undefined,
  aboutUs: string,
): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;

  const businessLine = businessName?.trim()
    ? `Business: "${businessName.trim()}"`
    : "Business: (unknown)";

  const systemPrompt = `You extract the business owner's first name from an Angi/HomeAdvisor "About us" profile blurb.
Rules:
- Return the proprietor/owner first name ONLY when the text clearly names them (e.g. "My name is Lucas Raposo, owner of..." → Lucas).
- Do NOT return employee names, reviewer names, or generic team references.
- Do NOT guess from the business name alone.
- If uncertain or no clear owner name, return null.
- Respond with JSON only: { "owner_name": "FirstName" } or { "owner_name": null }.`;

  const userPrompt = `${businessLine}
About us:
${aboutUs.trim()}`;

  let res: Response;
  try {
    res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 64,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const result = ownerNameResponseSchema.safeParse(parsed);
  if (!result.success) return null;
  return normalizeAngiOwnerName(result.data.owner_name);
}

/**
 * Resolve owner first name from Angi profile "About us" text.
 * Regex first; DeepSeek when the blurb is substantive but patterns miss.
 */
export async function resolveAngiOwnerNameFromAboutUs(
  aboutUs: string | null | undefined,
  businessName?: string | null,
): Promise<string | null> {
  const text = aboutUs?.trim();
  if (!text || text.length < 12) return null;

  const fromRegex = extractOwnerNameFromAngiAboutUsRegex(text);
  if (fromRegex) return fromRegex;

  if (text.length < 40) return null;
  return deepseekOwnerFromAboutUs(businessName, text);
}
