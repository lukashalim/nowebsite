import { z } from "zod";
import type { AngiListingInput } from "./angi-listing";
import {
  addressesMatch,
  companyNameFromAngiTitle,
  normalizeBusinessNameForMatch,
  profileLocationMatchesInput,
  tokenizeName,
  tokenOverlapScore,
  similarityRatio,
} from "./angi-listing";
import { extractAddressFromAngiPageText, leadStreetLineOnly } from "./angi-profile-scrape";

/** Auto-accept name match without LLM when score is at or above this. */
export const ANGI_IDENTITY_STRONG_NAME_THRESHOLD = 0.75;

/** Below this name score (and no address), hard-reject without LLM. */
export const ANGI_IDENTITY_WEAK_NAME_THRESHOLD = 0.35;

const GENERIC_BUSINESS_TOKENS = new Set([
  "and",
  "the",
  "inc",
  "llc",
  "co",
  "company",
  "services",
  "service",
  "repair",
  "repairs",
  "plumbing",
  "hvac",
  "heating",
  "air",
  "conditioning",
  "mechanical",
  "electric",
  "electrical",
  "appliance",
  "tree",
  "trimming",
  "landscaping",
  "septic",
  "tank",
  "drain",
  "clearing",
  "home",
  "pro",
  "pros",
  "roofing",
  "construction",
  "remodeling",
  "garage",
  "door",
  "doors",
  "pest",
  "control",
  "cleaning",
  "floor",
  "flooring",
  "concrete",
  "cooling",
  "contractors",
  "contractor",
  "specialists",
  "solutions",
  "guys",
  "crew",
]);

const identityResponseSchema = z.object({
  same_business: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
});

export type AngiProfileIdentityMethod =
  | "location_reject"
  | "address"
  | "strong_name"
  | "generic_reject"
  | "weak_reject"
  | "llm_accept"
  | "llm_reject"
  | "name_reject";

export interface AngiProfileIdentityResult {
  isMatch: boolean;
  method: AngiProfileIdentityMethod;
  nameScore: number;
  signals: string[];
}

export interface AngiProfileIdentityContext {
  addressOnPage?: string | null;
  serpHaystack?: string | null;
  aboutUsText?: string | null;
}

function distinctiveTokens(businessName: string): string[] {
  const bizTokens = tokenizeName(normalizeBusinessNameForMatch(businessName));
  const distinctive = bizTokens.filter(
    (t) => t.length >= 4 && !GENERIC_BUSINESS_TOKENS.has(t),
  );
  if (distinctive.length > 0) return distinctive;
  return bizTokens.filter((t) => t.length >= 3);
}

/** Names with fewer than 2 distinctive tokens need address confirmation. */
export function isGenericAngiBusinessName(
  businessName: string | null | undefined,
): boolean {
  const name = businessName?.trim();
  if (!name) return true;
  return distinctiveTokens(name).length < 2;
}

export function computeAngiProfileNameScore(
  businessName: string,
  profileTitle: string | null | undefined,
  profileUrl: string | null | undefined,
): { score: number; titleHits: number; urlHits: number; distinctiveCount: number } {
  const bizNorm = normalizeBusinessNameForMatch(businessName);
  if (!bizNorm) {
    return { score: 0, titleHits: 0, urlHits: 0, distinctiveCount: 0 };
  }

  const titleName = companyNameFromAngiTitle(profileTitle);
  const titleNorm = normalizeBusinessNameForMatch(titleName || profileTitle);
  const distinctive = distinctiveTokens(businessName);
  const titleHay = (titleName || profileTitle || "").toLowerCase();
  const urlHay = (profileUrl ?? "").toLowerCase();

  let score = Math.max(
    tokenOverlapScore(tokenizeName(bizNorm), tokenizeName(titleNorm)),
    similarityRatio(bizNorm, titleNorm),
  );

  const titleHits = distinctive.filter((t) => titleHay.includes(t)).length;
  const urlHits = distinctive.filter((t) => urlHay.includes(t)).length;

  if (distinctive.length > 0) {
    score = Math.max(score, titleHits / distinctive.length);
    score = Math.max(score, urlHits / distinctive.length);
  }

  // URL-only overlap is weaker than a title match (ZZ landscaping → eagles-texas-landscaping).
  if (titleHits === 0 && urlHits > 0) {
    score = Math.min(score, 0.55);
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    titleHits,
    urlHits,
    distinctiveCount: distinctive.length,
  };
}

function profileAddressMatchesLead(
  leadAddress: string | null | undefined,
  ...candidateTexts: Array<string | null | undefined>
): boolean {
  if (!leadAddress?.trim()) return false;
  for (const text of candidateTexts) {
    if (!text?.trim()) continue;
    const extracted = extractAddressFromAngiPageText(text) ?? text.trim();
    if (addressesMatch(leadAddress, extracted)) return true;
  }
  return false;
}

async function llmJudgeAngiProfileIdentity(
  input: AngiListingInput,
  profileTitle: string | null | undefined,
  profileUrl: string | null | undefined,
  ctx: AngiProfileIdentityContext,
): Promise<{ sameBusiness: boolean; confidence: number } | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;

  const profileTitleClean = companyNameFromAngiTitle(profileTitle) || profileTitle;
  const aboutUs = ctx.aboutUsText?.trim().slice(0, 600) ?? "";

  const systemPrompt = `You decide if a local business lead and an Angi/HomeAdvisor profile refer to the SAME company.
Rules:
- same_business=true only when they are clearly the same operation (DBA vs legal name OK, e.g. "Waters Septic" vs "Waters Wastewater Technologies").
- same_business=false when they are different companies that share a trade or city (e.g. "ZZ landscaping" vs "Eagle's Texas Landscaping", or "Seattle Heating" vs "Evergreen Home Heating").
- Do not match on trade/category words alone (plumbing, HVAC, roofing, etc.).
- Address agreement strongly supports same_business=true.
- If uncertain, return same_business=false.
Respond JSON only: { "same_business": boolean, "confidence": 0-1 }`;

  const userPrompt = `Lead:
- Name: ${input.name?.trim() || "(unknown)"}
- City: ${input.city?.trim() || "(unknown)"}
- State: ${input.state?.trim() || "(unknown)"}
- Address: ${leadStreetLineOnly(input.address) || "(none)"}

Angi profile:
- Title: ${profileTitleClean || "(unknown)"}
- URL: ${profileUrl || "(none)"}
- Address on page: ${ctx.addressOnPage?.trim() || "(unknown)"}
${aboutUs ? `- About us excerpt: ${aboutUs}` : ""}`;

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
        max_tokens: 80,
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

  const result = identityResponseSchema.safeParse(parsed);
  if (!result.success) return null;

  return {
    sameBusiness: result.data.same_business,
    confidence: result.data.confidence ?? (result.data.same_business ? 0.7 : 0.3),
  };
}

/**
 * Tiered identity check: address / strong name → auto; gray zone → DeepSeek; weak → reject.
 */
export async function resolveAngiProfileIdentity(
  input: AngiListingInput,
  profileUrl: string | null | undefined,
  profileTitle: string | null | undefined,
  ctx: AngiProfileIdentityContext = {},
): Promise<AngiProfileIdentityResult> {
  const businessName = input.name?.trim() ?? "";
  const nameMetrics = computeAngiProfileNameScore(
    businessName,
    profileTitle,
    profileUrl,
  );

  if (!profileLocationMatchesInput(input, profileUrl)) {
    return {
      isMatch: false,
      method: "location_reject",
      nameScore: nameMetrics.score,
      signals: ["identity_location_mismatch"],
    };
  }

  const addressMatch = profileAddressMatchesLead(
    input.address,
    ctx.addressOnPage,
    ctx.serpHaystack,
  );
  if (addressMatch) {
    return {
      isMatch: true,
      method: "address",
      nameScore: nameMetrics.score,
      signals: ["identity_address_match"],
    };
  }

  const generic = isGenericAngiBusinessName(businessName);
  if (generic) {
    return {
      isMatch: false,
      method: "generic_reject",
      nameScore: nameMetrics.score,
      signals: ["identity_generic_name_needs_address"],
    };
  }

  if (
    nameMetrics.score >= ANGI_IDENTITY_STRONG_NAME_THRESHOLD &&
    nameMetrics.titleHits >= 1
  ) {
    return {
      isMatch: true,
      method: "strong_name",
      nameScore: nameMetrics.score,
      signals: ["identity_strong_name"],
    };
  }

  if (nameMetrics.score < ANGI_IDENTITY_WEAK_NAME_THRESHOLD) {
    return {
      isMatch: false,
      method: "weak_reject",
      nameScore: nameMetrics.score,
      signals: ["identity_weak_name"],
    };
  }

  const llm = await llmJudgeAngiProfileIdentity(
    input,
    profileTitle,
    profileUrl,
    ctx,
  );
  if (llm) {
    if (llm.sameBusiness && llm.confidence >= 0.6) {
      return {
        isMatch: true,
        method: "llm_accept",
        nameScore: nameMetrics.score,
        signals: ["identity_llm_match"],
      };
    }
    return {
      isMatch: false,
      method: "llm_reject",
      nameScore: nameMetrics.score,
      signals: ["identity_llm_reject"],
    };
  }

  // No API key or LLM failure: fall back to conservative rule (title token required).
  const ruleMatch =
    nameMetrics.titleHits >= 1 &&
    nameMetrics.score >= ANGI_IDENTITY_WEAK_NAME_THRESHOLD;

  return {
    isMatch: ruleMatch,
    method: ruleMatch ? "strong_name" : "name_reject",
    nameScore: nameMetrics.score,
    signals: ruleMatch ? ["identity_rule_fallback"] : ["identity_name_mismatch"],
  };
}

/** Sync pre-scrape gate: worth loading the profile page? */
export function shouldScrapeAngiProfile(
  input: AngiListingInput,
  profileUrl: string | null | undefined,
  profileTitle: string | null | undefined,
  serpHaystack?: string | null,
): boolean {
  if (!profileLocationMatchesInput(input, profileUrl)) return false;

  if (profileAddressMatchesLead(input.address, serpHaystack)) return true;
  if (input.address?.trim()) return true;

  const metrics = computeAngiProfileNameScore(
    input.name?.trim() ?? "",
    profileTitle,
    profileUrl,
  );
  if (isGenericAngiBusinessName(input.name)) return false;

  return (
    metrics.titleHits >= 1 &&
    metrics.score >= 0.55
  );
}
