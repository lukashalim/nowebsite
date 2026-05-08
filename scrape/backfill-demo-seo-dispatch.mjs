import {
  loadEnvLocal,
  getSupabase,
  sleep,
  extractLeafTaskId,
  buildGoogleMapsDispatchData,
  mapsLinkFromBusinessRow,
  botasaurusCreateTaskAsync,
} from "./lib/scrape-pipeline/index.mjs";
const BUSINESSES_TABLE = process.env.BUSINESSES_TABLE ?? "businesses";
const SCRAPE_JOBS_TABLE = process.env.SCRAPE_JOBS_TABLE ?? "scrape_jobs";

function parseLimitArg(argv) {
  const idx = argv.findIndex((a) => a === "--limit");
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number.parseInt(argv[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const eq = argv.find((a) => /^--limit=/.test(a));
  if (eq) {
    const n = Number.parseInt(eq.split("=")[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const envN = Number.parseInt(process.env.BACKFILL_DEMO_SEO_LIMIT ?? "300", 10);
  return Number.isFinite(envN) && envN > 0 ? envN : 300;
}

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();

  const totalLimit = parseLimitArg(process.argv);
  const perTask = Math.max(
    1,
    Number.parseInt(process.env.BACKFILL_LINKS_PER_TASK ?? "25", 10) || 25,
  );
  const pauseMs = Math.max(
    0,
    Number.parseInt(process.env.BACKFILL_DISPATCH_SLEEP_MS ?? "5000", 10) || 5000,
  );

  const { data: rows, error } = await supabase
    .from(BUSINESSES_TABLE)
    .select(
      "place_id, business_type, postal_code, google_maps_link, review_highlights, services_offered, hours, open_now",
    )
    .or(
      "review_highlights.is.null,services_offered.is.null,hours.is.null,open_now.is.null",
    )
    .order("scraped_at", { ascending: true })
    .limit(totalLimit);

  if (error) throw new Error(error.message);
  if (!rows?.length) {
    console.log("backfill-demo-seo-dispatch: no matching rows.");
    return;
  }

  const links = [];
  for (const row of rows) {
    const link = mapsLinkFromBusinessRow(row);
    if (!link) continue;
    links.push({
      place_id: row.place_id,
      business_type: row.business_type ?? "unknown",
      postal_code: row.postal_code ? String(row.postal_code) : null,
      link,
    });
  }

  if (!links.length) {
    console.log("backfill-demo-seo-dispatch: 0 resolvable maps links.");
    return;
  }

  console.log(
    `backfill-demo-seo-dispatch: queueing ${links.length} link(s) in chunks of ${perTask}.`,
  );

  for (let i = 0; i < links.length; i += perTask) {
    const chunk = links.slice(i, i + perTask);
    const searchLinks = chunk.map((x) => x.link);
    try {
      const data = buildGoogleMapsDispatchData(searchLinks, 100, {
        enableEmailsSocial: true,
      });
      const created = await botasaurusCreateTaskAsync({
        data,
        scraper_name: "google_maps_scraper",
      });
      const taskId = extractLeafTaskId(created);
      if (taskId == null) {
        throw new Error(
          `Could not parse leaf task_id: ${JSON.stringify(created).slice(0, 300)}`,
        );
      }

      const representative = chunk[0];
      const { error: insertErr } = await supabase.from(SCRAPE_JOBS_TABLE).upsert(
        {
          task_id: taskId,
          business_type: representative.business_type,
          zip_code: representative.postal_code,
          status: "pending",
        },
        {
          onConflict: "task_id",
          ignoreDuplicates: true,
        },
      );
      if (insertErr) {
        if (/duplicate key|23505/i.test(insertErr.message)) {
          console.log(
            `backfill-demo-seo-dispatch: task ${taskId} already in ${SCRAPE_JOBS_TABLE}, skipped.`,
          );
        } else {
          throw new Error(insertErr.message);
        }
      } else {
        console.log(
          `backfill-demo-seo-dispatch: created task ${taskId} for ${chunk.length} link(s).`,
        );
      }
    } catch (e) {
      console.error(
        `backfill-demo-seo-dispatch: chunk ${i}-${i + chunk.length - 1}:`,
        e.message ?? e,
      );
    }
    if (i + perTask < links.length) {
      await sleep(pauseMs);
    }
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
