import {
  loadEnvLocal,
  getSupabase,
  parseBusinessTypeArg,
  parseStateArg,
  sleep,
  extractLeafTaskId,
  buildGoogleMapsDispatchData,
  mapsSearchLinkForZip,
  botasaurusCreateTaskAsync,
} from "./lib/scrape-pipeline/index.mjs";

const ZIP_PAGE_SIZE = 1000;
const SCRAPE_JOBS_TABLE = process.env.SCRAPE_JOBS_TABLE ?? "scrape_jobs";

async function fetchDistinctZipsFromTable(supabase, physicalState) {
  const set = new Set();
  let from = 0;
  for (;;) {
    let q = supabase
      .from("zip_locale_detail")
      .select("physical_zip")
      .order("physical_zip", { ascending: true });
    if (physicalState) {
      q = q.eq("physical_state", physicalState);
    }
    const { data, error } = await q.range(from, from + ZIP_PAGE_SIZE - 1);
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.length) {
      break;
    }
    for (const row of data) {
      const z = row.physical_zip;
      if (z != null && String(z).trim() !== "") {
        set.add(String(z).trim());
      }
    }
    if (data.length < ZIP_PAGE_SIZE) {
      break;
    }
    from += ZIP_PAGE_SIZE;
  }
  return [...set].sort();
}

async function main() {
  loadEnvLocal();
  const businessType = parseBusinessTypeArg(process.argv);
  if (!businessType) {
    console.error(
      "Usage: node dispatch.mjs --business_type='lawn care' [--state=OH]",
    );
    process.exit(1);
  }

  const stateFilter = parseStateArg(process.argv);

  const supabase = getSupabase();

  let zipCodes = await fetchDistinctZipsFromTable(supabase, stateFilter);
  if (zipCodes.length === 0) {
    console.error(
      stateFilter
        ? `No zip codes for physical_state=${stateFilter} in zip_locale_detail.`
        : "No zip codes found in zip_locale_detail.",
    );
    process.exit(1);
  }
  const maxZipsRaw = process.env.DISPATCH_MAX_ZIPS?.trim();
  if (maxZipsRaw) {
    const n = Number.parseInt(maxZipsRaw, 10);
    if (Number.isFinite(n) && n > 0) {
      zipCodes = zipCodes.slice(0, n);
    }
  }

  console.error(
    `Loaded ${zipCodes.length} zip(s) to dispatch from zip_locale_detail` +
      (stateFilter ? ` (state ${stateFilter})` : "") +
      (maxZipsRaw ? ` [DISPATCH_MAX_ZIPS=${maxZipsRaw}]` : "") +
      ". GMaps enable_emails_social (FACEBOOK enrichment).",
  );

  for (let i = 0; i < zipCodes.length; i++) {
    const zipCode = zipCodes[i];
    try {
      const searchLinks = [mapsSearchLinkForZip(businessType, zipCode)];
      const data = buildGoogleMapsDispatchData(searchLinks, 100, {
        enableEmailsSocial: true,
      });

      const created = await botasaurusCreateTaskAsync({
        data,
        scraper_name: "google_maps_scraper",
      });
      const taskId = extractLeafTaskId(created);
      if (taskId == null) {
        console.error(
          "Could not parse leaf task_id from response:",
          JSON.stringify(created).slice(0, 500),
        );
        continue;
      }

      const { error } = await supabase.from(SCRAPE_JOBS_TABLE).insert({
        task_id: taskId,
        business_type: businessType,
        zip_code: zipCode,
        status: "pending",
      });
      if (error) {
        throw new Error(error.message);
      }

      console.log(`Created task ${taskId} for ${businessType} in ${zipCode}`);
    } catch (err) {
      console.error(`dispatch error for zip ${zipCode}:`, err.message ?? err);
    }

    if (i < zipCodes.length - 1) {
      await sleep(5000);
    }
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
