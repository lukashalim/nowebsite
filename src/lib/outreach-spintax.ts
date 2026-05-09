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

const SYSTEM_PROMPT = `You write concise outreach spintax for cold DMs. Output rules:
- Return ONE line only: valid spintax using curly braces with pipe separators, e.g. {Hi|Hey|Hello} **Name** — {rest A|rest B}.
- Use markdown bold around the business name exactly as shown: **SHORT_NAME** (we will replace SHORT_NAME — keep the double asterisks around it in every branch where the name appears).
- Meaning: warn that using Facebook as the website on their Google Business Profile hurts local ranking; you fix it with a simple site; ask permission to share a demo.
- Stay professional, short, and non-spammy. No emojis unless inside a spintax option.
- Do not wrap in code fences. No explanation before or after the spintax line.`;

function userPrompt(shortName: string, fullName: string): string {
  return `SHORT_NAME (use in message, bolded): **${shortName}**
Full business name (context only): ${fullName || shortName}

Base idea (paraphrase into spintax with multiple synonym branches):
"Hey **${shortName}** - Having your facebook as your website on your google listing hurts your ranking. I fix that with a simple site. Mind if I share a demo?"

Produce spintax that varies the greeting, the middle sentence, and the closing question, while always using **${shortName}** for the name when you address them.`;
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
      temperature: 0.75,
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
  return raw.replace(/^```[\w]*\n?|\n?```$/g, "").trim();
}
