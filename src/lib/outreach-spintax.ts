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
- Return ONE line only: complete flat spintax — no curly braces, no markdown, no **bold**.
- Format exactly: Hey ACTUAL_NAME - group1optA|group1optB. group2optA|group2optB. group3optA|group3optB
  - Use the real business name once after "Hey " (plain text, not a placeholder).
  - Separate spin groups with ". " (period + space). Inside each group, separate alternatives with "|" only (no "|." — put the period inside each alternative where the sentence needs it, or end the group with a single period after the last alternative if the whole group is one sentence).
  - Typically 3 groups: (1) warning about Facebook as website on Google / GMB hurting ranking, (2) you fix it with a simple site, (3) permission to share a demo (questions can end with ?).
- Meaning: warn that using Facebook as the website on their Google Business Profile hurts local ranking; you fix it with a simple site; ask permission to share a demo.
- Stay professional, short, and non-spammy. No emojis.
- Do not wrap in code fences. No explanation before or after the line.

Good shape (example — use their real name, not this business):
Hey Arcade Resurrection - having Facebook as your website on Google hurts your local ranking|using Facebook as your site on Google Business Profile drops your ranking. I fix that with a simple site|I can fix that with a straightforward website. Mind if I share a demo?|Can I send you a short demo?`;

function userPrompt(shortName: string, fullName: string): string {
  return `Address them using this short name in the line (plain text after "Hey "): ${shortName}
Full business name (context only): ${fullName || shortName}

Base idea (paraphrase into flat pipe spintax with 2–3 alternatives per group):
"Hey ${shortName} - Having Facebook as your website on your Google listing hurts your ranking. I fix that with a simple site. Mind if I share a demo?"

Output one line in the flat format from the system rules.`;
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
