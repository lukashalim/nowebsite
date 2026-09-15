/**
 * Playwright scrape of Angi/HomeAdvisor business profile pages
 * to detect Angi Approved (paid advertiser) badges.
 *
 * Angi Cloudflare often blocks bare headless Chrome; we use a light
 * stealth fingerprint. If blocked, callers should fall back to SERP heuristics.
 */

export interface AngiProfileScrapeResult {
  ok: boolean;
  blocked: boolean;
  isApproved: boolean;
  signals: string[];
  phoneOnPage: string | null;
  /** Street address line from the profile header, when present. */
  addressOnPage: string | null;
  /** Angi/HomeAdvisor "About us" blurb, when present. */
  aboutUsText: string | null;
  error?: string;
}

const BLOCKED_RE =
  /sorry, you have been blocked|security verification|attention required|cf-browser-verification|performing security verification|you are unable to access angi\.com/i;

/** Strip recommendation carousels that mention "Angi Approved Pros". */
export function stripAngiRecommendationNoise(text: string): string {
  return text
    .replace(/Still browsing[\s\S]*$/i, "")
    .replace(/Check out these Angi Approved Pros[\s\S]*$/i, "")
    .replace(/Similar Pros[\s\S]*$/i, "");
}

/**
 * Detect Angi Approved on a profile page body text.
 * Requires the badge near the business header — not footer carousels.
 */
export function detectAngiApprovedFromPageText(
  rawText: string,
  businessName?: string | null,
): { isApproved: boolean; signals: string[] } {
  const signals: string[] = [];
  const text = stripAngiRecommendationNoise(rawText);
  const header = text.slice(0, 2500);

  if (/angi\s*approved/i.test(header)) {
    signals.push("angi_approved_phrase");
  }

  // Header badge pattern: "... Approved The Business Name" or "Approved" before rating
  if (/\bApproved\s+[A-Z0-9]/.test(header)) {
    signals.push("approved_before_name");
  }
  if (/\bApproved\b[\s\S]{0,120}\d\.\d/.test(header)) {
    signals.push("approved_near_rating");
  }

  if (businessName?.trim()) {
    const escaped = businessName
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    if (new RegExp(`\\bApproved\\s+${escaped}`, "i").test(header)) {
      signals.push("approved_before_business_name");
    }
  }

  if (/super\s*service\s*award/i.test(header)) {
    signals.push("super_service_award");
  }

  // Paid advertiser / Approved is the primary signal we care about.
  const isApproved =
    signals.includes("angi_approved_phrase") ||
    signals.includes("approved_before_business_name") ||
    signals.includes("approved_before_name") ||
    signals.includes("approved_near_rating");

  return { isApproved, signals };
}

export function isAngiBusinessProfileUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  if (!/angi\.com|homeadvisor\.com/.test(u)) return false;
  // Angi business profile
  if (/-reviews-(?:\d+|1)\.htm/.test(u) || /-reviews-\d+\.htm/.test(u)) return true;
  // HomeAdvisor rated profile
  if (/\/rated\.[a-z0-9_-]+\.\d+\.html/.test(u)) return true;
  return false;
}

const STREET_ADDRESS_RE =
  /\d+\s+[A-Za-z0-9][A-Za-z0-9\s.'-]*(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Circle|Cir|Court|Ct|Way|Place|Pl)\.?(?:\s+(?:East|West|North|South|E|W|N|S))?(?:,\s*[A-Za-z\s.'-]+,\s*[A-Z]{2}(?:\s+\d{5})?)?/i;

const ABOUT_US_STOP_RE =
  /^(business highlights|services we offer|amenities|reviews|phone number|accepted payment methods|free estimates|years of experience|homeowner services|all statements concerning)/i;

/** Extract the Angi/HomeAdvisor "About us" blurb from profile body text. */
export function extractAboutUsFromAngiPageText(rawText: string): string | null {
  const text = stripAngiRecommendationNoise(rawText);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let collecting = false;
  const parts: string[] = [];

  for (const line of lines) {
    if (/^about us$/i.test(line)) {
      collecting = true;
      continue;
    }
    if (!collecting) continue;
    if (ABOUT_US_STOP_RE.test(line)) break;
    if (/^about$/i.test(line) || /^reviews$/i.test(line)) break;
    parts.push(line);
  }

  const aboutUs = parts.join(" ").replace(/\s+/g, " ").trim();
  return aboutUs.length >= 12 ? aboutUs : null;
}

/** Pull the first US-style street line from Angi profile or SERP text. */
export function extractAddressFromAngiPageText(rawText: string): string | null {
  const text = stripAngiRecommendationNoise(rawText);
  if (!text.trim()) return null;

  // Prefer standalone lines (Angi often puts the address on its own line).
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(STREET_ADDRESS_RE);
    if (match?.[0]) return match[0].trim();
  }

  // Fall back to scanning the full body — address may sit below nav/header noise.
  const match = text.slice(0, 20000).match(STREET_ADDRESS_RE);
  return match?.[0]?.trim() ?? null;
}

/** Street-only portion of a lead address (before city/state comma). */
export function leadStreetLineOnly(
  address: string | null | undefined,
): string | null {
  const raw = address?.trim();
  if (!raw) return null;
  const firstLine = raw.split(",")[0]?.trim();
  return firstLine || raw;
}

export function isAngiCategoryOrArticleUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  if (/\/articles\//.test(u)) return true;
  if (/\/companylist\/us\/[a-z]{2}\/[^/]+\/[a-z0-9-]+\.htm$/.test(u)) {
    // Category pages end in /plumbing.htm etc. — no "-reviews-"
    return !/-reviews-/.test(u);
  }
  if (/homeadvisor\.com\/c\./.test(u) && !/\/rated\./.test(u)) return true;
  return false;
}

let browserPromise: Promise<import("playwright").Browser> | null = null;

async function getSharedBrowser(): Promise<import("playwright").Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      let chromium;
      try {
        ({ chromium } = await import("playwright"));
      } catch {
        throw new Error(
          "Missing playwright. Run: npm install playwright && npx playwright install chromium",
        );
      }
      return chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });
    })();
  }
  return browserPromise;
}

export async function closeAngiProfileBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    /* ignore */
  } finally {
    browserPromise = null;
  }
}

/**
 * Scrape an Angi/HomeAdvisor profile URL for Angi Approved signals.
 */
export async function scrapeAngiProfilePage(
  url: string,
  opts?: { businessName?: string | null; timeoutMs?: number },
): Promise<AngiProfileScrapeResult> {
  const timeoutMs = opts?.timeoutMs ?? 45000;
  try {
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
      locale: "en-US",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      await page.waitForTimeout(2800);

      const pageData = await page.evaluate(() => {
        const rawText = document.body?.innerText ?? "";
        let jsonLdAddress: string | null = null;
        for (const script of document.querySelectorAll(
          'script[type="application/ld+json"]',
        )) {
          try {
            const data = JSON.parse(script.textContent ?? "");
            const rows = Array.isArray(data) ? data : [data];
            for (const row of rows) {
              const addr = row?.address;
              if (!addr || typeof addr !== "object") continue;
              const street = addr.streetAddress?.trim();
              const city = addr.addressLocality?.trim();
              const region = addr.addressRegion?.trim();
              const zip = addr.postalCode?.trim();
              if (street) {
                jsonLdAddress = [street, city, region, zip]
                  .filter(Boolean)
                  .join(", ")
                  .replace(/,\s*([A-Z]{2})\s*,/g, ", $1 ");
                break;
              }
            }
          } catch {
            /* ignore malformed JSON-LD */
          }
          if (jsonLdAddress) break;
        }
        return { rawText, jsonLdAddress };
      });

      const rawText = pageData.rawText;

      if (BLOCKED_RE.test(rawText)) {
        return {
          ok: false,
          blocked: true,
          isApproved: false,
          signals: ["cloudflare_blocked"],
          phoneOnPage: null,
          addressOnPage: null,
          aboutUsText: null,
          error: "Angi/HomeAdvisor blocked the scrape (bot protection)",
        };
      }

      const { isApproved, signals } = detectAngiApprovedFromPageText(
        rawText,
        opts?.businessName,
      );
      const phoneMatch = rawText.match(/\(\d{3}\)\s*\d{3}-\d{4}/);
      const addressOnPage =
        extractAddressFromAngiPageText(rawText) ?? pageData.jsonLdAddress;
      const aboutUsText = extractAboutUsFromAngiPageText(rawText);
      return {
        ok: true,
        blocked: false,
        isApproved,
        signals,
        phoneOnPage: phoneMatch?.[0] ?? null,
        addressOnPage,
        aboutUsText,
      };
    } finally {
      await context.close();
    }
  } catch (err) {
    return {
      ok: false,
      blocked: false,
      isApproved: false,
      signals: [],
      phoneOnPage: null,
      addressOnPage: null,
      aboutUsText: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
