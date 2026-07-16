import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const POSTCARD_STORAGE_BUCKET = "postcard-screenshots";
export const LOB_POSTCARD_WIDTH = 1275;
export const LOB_POSTCARD_HEIGHT = 1875;

const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 2;

function sanitizePlaceId(placeId: string): string {
  return String(placeId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function postcardStoragePath(username: string, placeId: string): string {
  return `${username.trim()}/${sanitizePlaceId(placeId)}.jpg`;
}

async function ensureBucket(
  supabase: ReturnType<typeof createSupabaseAdmin>,
): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Storage listBuckets failed: ${error.message}`);
  if ((buckets ?? []).some((b) => b.name === POSTCARD_STORAGE_BUCKET)) return;
  const { error: createErr } = await supabase.storage.createBucket(
    POSTCARD_STORAGE_BUCKET,
    { public: true, fileSizeLimit: 10 * 1024 * 1024 },
  );
  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`Storage createBucket failed: ${createErr.message}`);
  }
}

export async function getExistingPostcardPublicUrl(
  username: string,
  placeId: string,
): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const path = postcardStoragePath(username, placeId);
  const { data: listed, error } = await supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .list(username.trim(), { search: sanitizePlaceId(placeId) });
  if (error) {
    // Bucket may not exist yet.
    return null;
  }
  const hit = (listed ?? []).some(
    (f) => f.name === `${sanitizePlaceId(placeId)}.jpg`,
  );
  if (!hit) return null;
  const { data } = supabase.storage
    .from(POSTCARD_STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * Capture demo homepage at Lob 4×6 portrait bleed size and upload to Storage.
 */
export async function captureAndStorePostcardFront(input: {
  username: string;
  placeId: string;
  captureUrl: string;
}): Promise<string> {
  const [{ chromium }, sharpMod] = await Promise.all([
    import("playwright"),
    import("sharp"),
  ]);
  const sharp = sharpMod.default;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    const response = await page.goto(input.captureUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`Demo page HTTP ${status} for ${input.captureUrl}`);
    }

    const ready = await page.waitForFunction(
      () => {
        const text = document.body?.innerText ?? "";
        if (text.includes("This page could not be found")) return "404";
        if (document.querySelector("h1")) return "ok";
        return false;
      },
      { timeout: 45_000 },
    );
    if ((await ready.jsonValue()) === "404") {
      throw new Error(`Demo page rendered 404 for ${page.url()}`);
    }

    await page.addStyleTag({
      content: `
        aside[aria-label="Activate your site"] { display: none !important; }
        section[aria-labelledby="reviews-heading"] nav,
        section[aria-labelledby="reviews-heading"] button {
          display: none !important;
        }
      `,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 500));

    const png = await page.screenshot({ type: "png", fullPage: false });
    const jpg = await sharp(png)
      .resize(LOB_POSTCARD_WIDTH, LOB_POSTCARD_HEIGHT, {
        fit: "cover",
        position: "top",
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const supabase = createSupabaseAdmin();
    await ensureBucket(supabase);
    const path = postcardStoragePath(input.username, input.placeId);
    const { error: upErr } = await supabase.storage
      .from(POSTCARD_STORAGE_BUCKET)
      .upload(path, jpg, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upErr) {
      throw new Error(`Screenshot upload failed: ${upErr.message}`);
    }
    const { data } = supabase.storage
      .from(POSTCARD_STORAGE_BUCKET)
      .getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error("Could not resolve public URL for postcard screenshot");
    }
    return data.publicUrl;
  } finally {
    await browser.close();
  }
}

export async function ensurePostcardFrontUrl(input: {
  username: string;
  placeId: string;
  captureUrl: string;
  force?: boolean;
}): Promise<string> {
  if (!input.force) {
    const existing = await getExistingPostcardPublicUrl(
      input.username,
      input.placeId,
    );
    if (existing) return existing;
  }
  return captureAndStorePostcardFront(input);
}
