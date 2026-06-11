/**
 * Read google_maps_scraper NDJSON from the Google Maps Extractor desktop app
 * (%AppData%/Roaming/googlemapsextractor/task_results/cache) and emit businesses
 * that match core filters (no website by default, min rating; no review count band).
 *
 * Primary local ingest path: read Google Maps Extractor desktop app cache → filter → Supabase.
 * Supplemental to the EC2 dispatch/poller/pipeline.
 *
 * Usage (from scrape/):
 *   node extract-local-extractor-cache.mjs --business-type "Appliance repair"
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  loadEnvLocal,
  getSupabase,
  getMinRecentReviewsFilterConfig,
  parseBusinessTypeArg,
} from "./lib/scrape-pipeline/index.mjs";
import {
  emptyIngestStats,
  createIngestRunner,
  applyCategoryContentStats,
  persistExtractRunLog,
} from "./lib/ingest-filtered-rows.mjs";

const DEFAULT_WIN_EXTRACTOR_DIR = "googlemapsextractor";

/** Set at start of `main()` for crash logging in `.catch`. */
let currentExtractRunStartedMs = 0;

function normalizeExtractorRoot(resolved) {
  const p = path.resolve(resolved);
  if (path.basename(p).toLowerCase() === "cache") {
    const oneUp = path.dirname(p);
    if (path.basename(oneUp).toLowerCase() === "task_results") {
      return path.dirname(oneUp);
    }
  }
  return p;
}

function defaultExtractorRoot() {
  const fromEnv = String(process.env.GOOGLE_MAPS_EXTRACTOR_DIR ?? "").trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return path.join(appData, DEFAULT_WIN_EXTRACTOR_DIR);
    }
  }
  return path.join(process.env.HOME || process.cwd(), DEFAULT_WIN_EXTRACTOR_DIR);
}

function parseRootArg(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const m = /^--root=(.*)$/.exec(arg);
    if (m) {
      return path.resolve(m[1].replace(/^['"]|['"]$/g, "").trim());
    }
    if (arg === "--root" && args[i + 1] && !args[i + 1].startsWith("--")) {
      return path.resolve(args[i + 1].replace(/^['"]|['"]$/g, "").trim());
    }
  }
  return null;
}

function hasFlag(argv, name) {
  return argv.slice(2).some((a) => a === name || a === `${name}=1` || a === `${name}=true`);
}

function envFlag(name, def = false) {
  const v = process.env[name];
  if (v == null) {
    return def;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") {
    return true;
  }
  if (s === "0" || s === "false" || s === "no") {
    return false;
  }
  return def;
}

function parseFormat(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const m = /^--format=(.*)$/.exec(args[i]);
    if (m) {
      return m[1].trim().toLowerCase();
    }
    if (args[i] === "--format" && args[i + 1] && !args[i + 1].startsWith("--")) {
      return args[i + 1].trim().toLowerCase();
    }
  }
  return "jsonl";
}

function parseMaxFiles(argv) {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const m = /^--max-files=(\d+)$/.exec(args[i]);
    if (m) {
      return Math.max(1, parseInt(m[1], 10));
    }
    if (args[i] === "--max-files" && args[i + 1] && /^\d+$/.test(args[i + 1])) {
      return Math.max(1, parseInt(args[i + 1], 10));
    }
  }
  return null;
}

function listNdjson(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ndjson"))
    .map((e) => path.join(dir, e.name));
}

function ndjsonFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function sortNdjsonBySizeAsc(files) {
  return files.sort((a, b) => {
    const diff = ndjsonFileSize(a) - ndjsonFileSize(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

async function* linesOfNdjson(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    yield t;
  }
}

const BUSINESSES_TABLE = process.env.BUSINESSES_TABLE ?? "businesses_nowebsite";
const FILE_LIST_REFRESH_EVERY = Math.max(
  10,
  Number.parseInt(process.env.EXTRACT_LOCAL_FILE_LIST_REFRESH_EVERY ?? "50", 10) || 50,
);
const TASKS_RETENTION_DAYS = Math.max(
  1,
  Number.parseInt(process.env.EXTRACT_LOCAL_TASKS_RETENTION_DAYS ?? "3", 10) || 3,
);

async function pruneOldTaskNdjson(tasksDir, retentionDays, stats) {
  if (!fs.existsSync(tasksDir)) {
    return;
  }
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ndjson")) {
      continue;
    }
    const filePath = path.join(tasksDir, entry.name);
    try {
      const st = fs.statSync(filePath);
      if (st.mtimeMs > cutoffMs) {
        continue;
      }
      await fs.promises.unlink(filePath);
      stats.tasksFilesDeleted += 1;
    } catch (err) {
      stats.tasksFilesDeleteFailed += 1;
      console.error(`Could not prune old task file ${filePath}: ${err?.message ?? err}`);
    }
  }
}

async function main() {
  const argv = process.argv;
  loadEnvLocal();
  const runStarted = Date.now();
  currentExtractRunStartedMs = runStarted;

  const root = normalizeExtractorRoot(parseRootArg(argv) ?? defaultExtractorRoot());
  const includeTasks = hasFlag(argv, "--include-tasks");
  const allowWebsite = hasFlag(argv, "--allow-website");
  const noSweetSpot = hasFlag(argv, "--no-sweet-spot");
  const keepFiles = hasFlag(argv, "--keep-files") || envFlag("EXTRACT_LOCAL_KEEP_FILES", false);
  const deleteAfter = !keepFiles;
  const dryRun = hasFlag(argv, "--dry-run");
  const format = parseFormat(argv);
  const businessType = parseBusinessTypeArg(argv) || "local_cache";
  const forcedCountry = process.env.EXTRACT_LOCAL_COUNTRY?.trim() || null;
  const locationHint =
    process.env.EXTRACT_LOCAL_LOCATION_HINT?.trim() ||
    process.env.EXTRACT_LOCAL_SCRAPE_ZIP?.trim() ||
    null;

  const supabase = getSupabase();
  const stats = emptyIngestStats(0);
  const runner = createIngestRunner({
    supabase,
    businessesTable: BUSINESSES_TABLE,
    businessType,
    locationHint,
    forcedCountry,
    allowWebsite,
    noSweetSpot,
    dryRun,
    dryRunFormat: format === "csv" ? "csv" : "jsonl",
    stats,
  });

  const cacheDir = path.join(root, "task_results", "cache");
  const tasksDir = path.join(root, "task_results", "tasks");
  const maxFiles = parseMaxFiles(argv);

  const seenFile = new Set();
  const pendingFiles = [];

  function refreshPendingFiles() {
    const discovered = sortNdjsonBySizeAsc([
      ...listNdjson(cacheDir),
      ...(includeTasks ? listNdjson(tasksDir) : []),
    ]);
    for (const fp of discovered) {
      if (seenFile.has(fp)) {
        continue;
      }
      if (maxFiles != null && seenFile.size >= maxFiles) {
        break;
      }
      seenFile.add(fp);
      pendingFiles.push(fp);
      stats.files += 1;
    }
    sortNdjsonBySizeAsc(pendingFiles);
  }

  refreshPendingFiles();

  if (pendingFiles.length === 0) {
    const msg = `No .ndjson files under ${cacheDir}${includeTasks ? ` or ${tasksDir}` : ""}. Check GOOGLE_MAPS_EXTRACTOR_DIR / --root.`;
    console.error(msg);
    await persistExtractRunLog({
      startedMs: runStarted,
      exitCode: 1,
      root,
      businessType,
      dryRun,
      businessesTable: BUSINESSES_TABLE,
      allowWebsite,
      noSweetSpot,
      stats,
      pendingCacheDeletes: 0,
      errorMessage: msg,
      filterSnapshotExtra: { source: "ndjson_cache" },
    });
    process.exit(1);
  }

  const norm = (p) => path.normalize(p);
  const isCacheFile = (fp) => norm(path.dirname(fp)) === norm(cacheDir);
  const cacheBasenamesDeleted = [];

  runner.printDryRunHeader();

  let processedFiles = 0;
  for (;;) {
    if (pendingFiles.length === 0) {
      refreshPendingFiles();
      if (pendingFiles.length === 0) {
        break;
      }
    }
    const filePath = pendingFiles.shift();
    if (!filePath) {
      continue;
    }
    try {
      for await (const line of linesOfNdjson(filePath)) {
        let raw;
        try {
          raw = JSON.parse(line);
        } catch {
          stats.jsonErrors += 1;
          continue;
        }
        await runner.processRow(raw);
      }

      await runner.flush(true);

      if (deleteAfter && !dryRun && stats.upsertBatchErrors === 0) {
        try {
          await fs.promises.unlink(filePath);
          stats.filesDeleted += 1;
          if (isCacheFile(filePath)) {
            cacheBasenamesDeleted.push(path.basename(filePath));
          }
        } catch (unlinkErr) {
          stats.filesDeleteFailed += 1;
          console.error(
            `Could not delete ${filePath}: ${unlinkErr?.message ?? unlinkErr}`,
          );
        }
      }
    } catch (fileErr) {
      if (fileErr?.code === "ENOENT") {
        stats.filesMissing += 1;
        console.error(`Skipped missing file: ${filePath}`);
        continue;
      }
      console.error(
        `Stopped on ${filePath} (file not deleted): ${fileErr?.message ?? fileErr}`,
      );
      throw fileErr;
    }
    processedFiles += 1;
    if (processedFiles % FILE_LIST_REFRESH_EVERY === 0) {
      refreshPendingFiles();
    }
  }

  await runner.flush(true);

  let categoryContentStats = null;

  const buildStatPayload = () => ({
    root,
    ...stats,
    dryRun,
    businessesTable: dryRun ? null : BUSINESSES_TABLE,
    deleteAfter,
    pendingCacheDeletes: 0,
    categoryContent: categoryContentStats,
    filters: {
      allowWebsite,
      noSweetSpot,
      sweetSpot: noSweetSpot
        ? null
        : {
            minRating: Number(process.env.SWEET_SPOT_MIN_RATING ?? 4),
          },
      minRecentReviews: {
        ...getMinRecentReviewsFilterConfig(),
        skipped: stats.skippedMinRecentReviews,
      },
      source: "ndjson_cache",
    },
  });

  if (deleteAfter && !dryRun && cacheBasenamesDeleted.length > 0) {
    const storagePath = path.join(root, "task_results", "cache_storage.json");
    try {
      if (fs.existsSync(storagePath)) {
        const rawJson = fs.readFileSync(storagePath, "utf8");
        const index = JSON.parse(rawJson);
        if (index && typeof index === "object" && !Array.isArray(index)) {
          for (const basename of cacheBasenamesDeleted) {
            delete index[basename];
          }
          fs.writeFileSync(
            storagePath,
            `${JSON.stringify(index, null, 4)}\n`,
            "utf8",
          );
        }
      }
    } catch (idxErr) {
      console.error(
        `cache_storage.json prune failed (${path.join(root, "task_results", "cache_storage.json")}): ${idxErr?.message ?? idxErr}`,
      );
    }
  }

  if (deleteAfter && !dryRun && stats.upsertBatchErrors > 0) {
    console.error(JSON.stringify(buildStatPayload(), null, 2));
    console.error(
      `Encountered ${stats.upsertBatchErrors} row upsert failure(s); files processed after first failure are kept for re-run.`,
    );
    await persistExtractRunLog({
      startedMs: runStarted,
      exitCode: 1,
      root,
      businessType,
      dryRun,
      businessesTable: BUSINESSES_TABLE,
      allowWebsite,
      noSweetSpot,
      stats,
      pendingCacheDeletes: 0,
      errorMessage: `Supabase upsert: ${stats.upsertBatchErrors} row failure(s); some files kept for re-run.`,
      filterSnapshotExtra: { source: "ndjson_cache" },
    });
    process.exit(1);
  }

  if (deleteAfter && !dryRun) {
    await pruneOldTaskNdjson(tasksDir, TASKS_RETENTION_DAYS, stats);
  }

  try {
    categoryContentStats = await applyCategoryContentStats(
      supabase,
      businessType,
      stats,
      dryRun,
    );
  } catch (catErr) {
    console.error("category_content stats failed:", catErr?.message ?? catErr);
    categoryContentStats = { error: String(catErr?.message ?? catErr) };
  }

  console.error(JSON.stringify(buildStatPayload(), null, 2));

  await persistExtractRunLog({
    startedMs: runStarted,
    exitCode: 0,
    root,
    businessType,
    dryRun,
    businessesTable: BUSINESSES_TABLE,
    allowWebsite,
    noSweetSpot,
    stats,
    pendingCacheDeletes: 0,
    errorMessage: null,
    filterSnapshotExtra: { source: "ndjson_cache" },
  });
}

main().catch(async (e) => {
  console.error(e.message ?? e);
  const av = process.argv;
  try {
    await persistExtractRunLog({
      startedMs: currentExtractRunStartedMs || Date.now(),
      exitCode: 1,
      root: normalizeExtractorRoot(parseRootArg(av) ?? defaultExtractorRoot()),
      businessType: parseBusinessTypeArg(av) || "local_cache",
      dryRun: hasFlag(av, "--dry-run"),
      businessesTable: process.env.BUSINESSES_TABLE ?? "businesses_nowebsite",
      allowWebsite: hasFlag(av, "--allow-website"),
      noSweetSpot: hasFlag(av, "--no-sweet-spot"),
      stats: emptyIngestStats(0),
      pendingCacheDeletes: 0,
      errorMessage: String(e?.message ?? e),
      filterSnapshotExtra: { source: "ndjson_cache" },
    });
  } catch {
    /* ignore secondary log failures */
  }
  process.exit(1);
});
