const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

/** Strip legal suffixes; keep up to ~3 words / 28 chars for casual outreach. */
export function shortenBusinessNameForOutreach(full: string | null): string {
  if (!full?.trim()) return "there";
  let s = full
    .replace(/\b(LLC|L\.L\.C\.|L\.L\.C|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.|Company|Ltd\.?|Limited|PLLC|P\.L\.L\.C\.)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  const take = words.slice(0, Math.min(3, words.length)).join(" ");
  if (take.length <= 28) return take || "there";
  return `${take.slice(0, 26).trimEnd()}…`;
}

export interface FacebookOutreachRow {
  place_id: string;
  name: string | null;
  facebook_url: string | null;
  crm_contact_surface: string | null;
  listing_website: string | null;
}

export function isEligibleForFacebookListingOutreach(row: FacebookOutreachRow): boolean {
  const listing = row.listing_website?.trim() ?? "";
  const listingIsFb = /facebook\.com|fb\.com|fb\.me/i.test(listing);
  const fb = row.facebook_url?.trim() ?? "";

  if (row.crm_contact_surface === "whatsapp") {
    return listingIsFb || Boolean(fb);
  }
  if (row.crm_contact_surface === "facebook") return true;
  if (listingIsFb) return true;
  return Boolean(fb);
}

const SYSTEM_PROMPT = `You write one concise cold-DM line for a local business. Output rules:
- Return exactly ONE version — a single message. No spintax: do not use the "|" character anywhere. No curly braces, no markdown, no **bold**.
- Structure: greeting with their name, then 2–3 short sentences separated by ". " (period + space).
  - Start with "Hey " plus the short name they gave you (plain text).
  - (1) Note that using Facebook as the website on their Google Business Profile / Google listing hurts local ranking (one clear wording).
  - (2) You fix that with a simple site (one clear wording).
  - (3) Ask permission to share a demo (one question).
- Stay professional, short, and non-spammy. No emojis.
- Do not wrap in code fences. No explanation before or after the line.

Good shape (example — use their real name, not this business):
Hey Arcade Resurrection - having Facebook as your website on Google hurts your local ranking. I fix that with a simple site. Mind if I share a demo?`;

function userPrompt(shortName: string, fullName: string): string {
  return `Address them using this short name after "Hey ": ${shortName}
Full business name (context only): ${fullName || shortName}

Paraphrase this idea into one polished line (remember: no "|" character, single version only):
"Hey ${shortName} - Having Facebook as your website on your Google listing hurts your ranking. I fix that with a simple site. Mind if I share a demo?"

Output that one line only.`;
}

/**
 * If the model still emits pipe-separated variants, keep the first option per sentence chunk.
 */
function collapsePipeVariants(line: string): string {
  const stripped = line
    .replace(/^```[\w]*\n?|\n?```$/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!stripped.includes("|")) return stripped;
  const chunks = stripped.split(/\.\s+/).map((chunk) => {
    const c = chunk.trim();
    if (!c.includes("|")) return c;
    return c.split("|")[0].trim();
  });
  return chunks.filter(Boolean).join(". ").trim();
}

export async function generateFacebookListingSpintax(
  shortName: string,
  fullName: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(shortName, fullName) },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new Error("Empty response from DeepSeek");
  }
  return collapsePipeVariants(raw);
}
