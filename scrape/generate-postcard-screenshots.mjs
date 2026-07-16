/**
 * Capture Lob-ready 4×6 portrait screenshots of personalized RingReady demo pages.
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/generate-postcard-screenshots.mjs \
 *     --username=YOURCRMUSER --limit 20
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/generate-postcard-screenshots.mjs \
 *     --username=YOURCRMUSER --dry-run --limit 5
 *
 *   node --import ./scrape/env-nowebsite-queue.mjs ./scrape/generate-postcard-screenshots.mjs \
 *     --url=https://www.ringreadysite.com/user/slug --local-only
 *
 * Output: 1275×1875 JPG (Lob 4.25″×6.25″ bleed @ 300 DPI). PNG via --format=png.
 * Requires: playwright + sharp (optionalDeps) and `npx playwright install chromium`.
 *
 * Env: Supabase via loadEnvLocal(). Optional: POSTCARD_SCREENSHOT_BATCH,
 *   POSTCARD_SCREENSHOT_SLEEP_MS, POSTCARD_SCREENSHOT_STATES.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, getSupabase } from "./lib/scrape-pipeline/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const RING_READY_ORIGIN = "https://www.ringreadysite.com";
const STORAGE_BUCKET = "postcard-screenshots";
const OUT_DIR = resolve(__dirname, "out", "postcard-screenshots");
const MANIFEST_PATH = join(OUT_DIR, "manifest.jsonl");

/** Lob 4×6 postcard bleed artboard @ 300 DPI (portrait). */
const LOB_WIDTH = 1275;
const LOB_HEIGHT = 1875;

const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 2;

const BATCH = Math.max(
  1,
  Number.parseInt(process.env.POSTCARD_SCREENSHOT_BATCH ?? "10", 10) || 10,
);
const SLEEP_MS = Math.max(
  0,
  Number.parseInt(process.env.POSTCARD_SCREENSHOT_SLEEP_MS ?? "500", 10) ||
    500,
);

const STATE_ALIAS_TO_DB = new Map([
  ["md", "Maryland"],
  ["maryland", "Maryland"],
  ["dc", "District Of Columbia"],
  ["district of columbia", "District Of Columbia"],
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLimit(argv) {
  const idx = argv.indexOf("--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseArgValue(argv, name) {
  const prefix = `--${name}=`;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).replace(/^['"]|['"]$/g, "").trim();
    }
  }
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith("--")) {
    return argv[idx + 1].trim();
  }
  return null;
}

function parseStatesArg(argv) {
  for (const arg of argv.slice(2)) {
    const m = /^--states=(.*)$/i.exec(arg);
    if (m) {
      return m[1]
        .split(",")
        .map((s) => s.replace(/^['"]|['"]$/g, "").trim())
        .filter(Boolean);
    }
  }
  const env = process.env.POSTCARD_SCREENSHOT_STATES?.trim();
  if (!env) return null;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveStateFilterValues(rawStates) {
  if (!rawStates?.length) return null;
  const resolved = new Set();
  for (const raw of rawStates) {
    const key = raw.trim().toLowerCase();
    const mapped = STATE_ALIAS_TO_DB.get(key);
    if (mapped) {
      resolved.add(mapped);
      continue;
    }
    resolved.add(raw.trim());
  }
  if (resolved.has("Maryland")) {
    resolved.add("MD");
  }
  return [...resolved];
}

function tenantDemoPublicPath(username, slug) {
  return `/${encodeURIComponent(username.trim())}/${encodeURIComponent(slug.trim())}`;
}

function buildDemoUrl(username, slug) {
  const path = tenantDemoPublicPath(username, slug);
  return `${RING_READY_ORIGIN}${path}?postcard=1`;
}

function withPostcardQuery(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("postcard", "1");
    return u.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}postcard=1`;
  }
}

function sanitizePlaceIdForFilename(placeId) {
  return String(placeId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function loadOptionalDeps() {
  let playwright;
  let sharp;
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Missing playwright. Run: npm install playwright && npx playwright install chromium",
    );
  }
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("Missing sharp. Run: npm install sharp");
  }
  return { chromium: playwright.chromium, sharp };
}

async function ensureStorageBucket(supabase) {
  const { data: buckets, error: listErr } =
    await supabase.storage.listBuckets();
  if (listErr) {
    throw new Error(`Storage listBuckets failed: ${listErr.message}`);
  }
  const exists = (buckets ?? []).some((b) => b.name === STORAGE_BUCKET);
  if (exists) return;

  const { error: createErr } = await supabase.storage.createBucket(
    STORAGE_BUCKET,
    { public: true, fileSizeLimit: 10 * 1024 * 1024 },
  );
  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`Storage createBucket failed: ${createErr.message}`);
  }
}

function publicStorageUrl(supabase, objectPath) {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectPath);
  return data?.publicUrl ?? null;
}

async function uploadToStorage(supabase, objectPath, buffer, contentType) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, buffer, {
      contentType,
      upsert: true,
    });
  if (error) {
    throw new Error(`Storage upload failed (${objectPath}): ${error.message}`);
  }
  return publicStorageUrl(supabase, objectPath);
}

/**
 * Cover-crop buffer into exact Lob bleed dimensions.
 */
async function toLobCanvas(sharp, pngBuffer, format) {
  const pipeline = sharp(pngBuffer)
    .resize(LOB_WIDTH, LOB_HEIGHT, {
      fit: "cover",
      position: "top",
    });

  if (format === "png") {
    return {
      buffer: await pipeline.png().toBuffer(),
      contentType: "image/png",
      ext: "png",
    };
  }
  return {
    buffer: await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    contentType: "image/jpeg",
    ext: "jpg",
  };
}

async function captureDemoScreenshot(page, url) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const status = response?.status() ?? 0;
  if (status >= 400) {
    throw new Error(`Demo page HTTP ${status} for ${url}`);
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
      /* Cleaner postcard: hide review carousel pager controls */
      section[aria-labelledby="reviews-heading"] nav,
      section[aria-labelledby="reviews-heading"] button {
        display: none !important;
      }
    `,
  });
  // Prefer reviews in view when present (postcard mode).
  const reviewsHeading = page.locator("#reviews-heading");
  if (await reviewsHeading.count()) {
    await reviewsHeading.scrollIntoViewIfNeeded().catch(() => {});
    // Scroll back so hero stays at top of the postcard frame.
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // Brief settle for fonts/images after banner hide.
  await sleep(500);
  return page.screenshot({ type: "png", fullPage: false });
}

function appendManifest(row) {
  mkdirSync(OUT_DIR, { recursive: true });
  appendFileSync(MANIFEST_PATH, `${JSON.stringify(row)}\n`, "utf8");
}

async function fetchLeads(supabase, { cap, placeId, stateFilter, force }) {
  const rows = [];
  let offset = 0;

  for (;;) {
    if (cap != null && rows.length >= cap) break;

    let q = supabase
      .from(TABLE)
      .select("place_id, name, demo_slug, state, city")
      .eq("is_invalid", false)
      .not("demo_slug", "is", null)
      .order("place_id", { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (placeId) {
      q = q.eq("place_id", placeId);
    }
    if (stateFilter?.length) {
      q = q.in("state", stateFilter);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const batch = (data ?? []).filter((r) => r.demo_slug?.trim());
    if (batch.length === 0) break;

    for (const row of batch) {
      if (cap != null && rows.length >= cap) break;
      rows.push(row);
    }

    if (placeId) break;
    if (batch.length < BATCH) break;
    offset += BATCH;

    // force unused for query paging; kept for CLI parity / skip-existing later
    void force;
  }

  return rows;
}

async function main() {
  loadEnvLocal();

  const argv = process.argv;
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const localOnly = argv.includes("--local-only");
  const cap = parseLimit(argv);
  const username = parseArgValue(argv, "username");
  const singleUrl = parseArgValue(argv, "url");
  const placeId = parseArgValue(argv, "place-id");
  const formatRaw = (parseArgValue(argv, "format") ?? "jpg").toLowerCase();
  const format = formatRaw === "png" ? "png" : "jpg";
  const stateFilter = resolveStateFilterValues(parseStatesArg(argv));

  if (!singleUrl && !username?.trim()) {
    throw new Error(
      "Required: --username=YOURCRMUSER (tenant demo path), or --url= for a single-shot test",
    );
  }

  if (stateFilter?.length) {
    console.log(`State filter: ${stateFilter.join(", ")}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  /** @type {{ place_id: string, name?: string|null, demo_slug?: string|null, demo_url: string }[]} */
  let jobs = [];

  if (singleUrl) {
    jobs = [
      {
        place_id: placeId || "manual",
        name: null,
        demo_slug: null,
        demo_url: withPostcardQuery(singleUrl),
      },
    ];
  } else {
    const supabase = getSupabase();
    const leads = await fetchLeads(supabase, {
      cap,
      placeId,
      stateFilter,
      force,
    });
    jobs = leads.map((row) => ({
      place_id: row.place_id,
      name: row.name,
      demo_slug: row.demo_slug,
      demo_url: buildDemoUrl(username, row.demo_slug.trim()),
    }));
  }

  if (jobs.length === 0) {
    console.log("No leads with demo_slug found.");
    return;
  }

  console.log(
    `Jobs: ${jobs.length} format=${format} localOnly=${localOnly}${dryRun ? " dry-run" : ""}`,
  );

  if (dryRun) {
    for (const job of jobs) {
      console.log(
        JSON.stringify({
          place_id: job.place_id,
          name: job.name,
          demo_url: job.demo_url,
          dryRun: true,
        }),
      );
    }
    console.log(
      `generate-postcard-screenshots: scanned=${jobs.length} (dry-run)`,
    );
    return;
  }

  const { chromium, sharp } = await loadOptionalDeps();
  const supabase = localOnly ? null : getSupabase();
  if (supabase) {
    await ensureStorageBucket(supabase);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const job of jobs) {
      const fileBase = sanitizePlaceIdForFilename(job.place_id);
      const localPath = join(OUT_DIR, `${fileBase}.${format}`);

      if (!force && existsSync(localPath)) {
        skipped += 1;
        console.log(
          JSON.stringify({
            place_id: job.place_id,
            skipped: "exists",
            local_path: localPath,
          }),
        );
        continue;
      }

      try {
        const rawPng = await captureDemoScreenshot(page, job.demo_url);
        const { buffer, contentType, ext } = await toLobCanvas(
          sharp,
          rawPng,
          format,
        );
        writeFileSync(localPath, buffer);

        let publicUrl = null;
        if (supabase && username) {
          const objectPath = `${username.trim()}/${fileBase}.${ext}`;
          publicUrl = await uploadToStorage(
            supabase,
            objectPath,
            buffer,
            contentType,
          );
        } else if (supabase && singleUrl) {
          const objectPath = `manual/${fileBase}.${ext}`;
          publicUrl = await uploadToStorage(
            supabase,
            objectPath,
            buffer,
            contentType,
          );
        }

        const manifestRow = {
          place_id: job.place_id,
          name: job.name ?? null,
          demo_url: job.demo_url,
          local_path: localPath,
          public_url: publicUrl,
          width: LOB_WIDTH,
          height: LOB_HEIGHT,
          format: ext,
          generated_at: new Date().toISOString(),
        };
        appendManifest(manifestRow);
        console.log(JSON.stringify(manifestRow));
        ok += 1;
      } catch (err) {
        failed += 1;
        console.error(
          JSON.stringify({
            place_id: job.place_id,
            demo_url: job.demo_url,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      if (SLEEP_MS > 0) {
        await sleep(SLEEP_MS);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    `generate-postcard-screenshots: ok=${ok} skipped=${skipped} failed=${failed} out=${OUT_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
