/**
 * Load completed enrichment_jobs from Botasaurus, merge contact fields into businesses.
 *
 * Env:
 *   ENRICH_OVERWRITE_FACEBOOK=1 — set facebook_url from scrape even if already set
 */
import {
  loadEnvLocal,
  getSupabase,
  fetchAllTaskResults,
  pick,
  omitUndefined,
  pickFacebookUrl,
} from "./lib/scrape-pipeline/index.mjs";

const BATCH = Math.max(
  10,
  Number.parseInt(process.env.BUSINESSES_UPSERT_BATCH_SIZE ?? "50", 10) || 50,
);

function rawToContactEnrichment(raw, taskId) {
  return omitUndefined({
    enrichment_task_id: taskId,
    captured_at: new Date().toISOString(),
    email: pick(raw, "email", "EMAIL", "recommended_email"),
    emails: pick(raw, "emails", "EMAILS"),
    emails_and_social: pick(raw, "emails_and_social", "EMAILS_AND_SOCIAL"),
    linkedin: pick(raw, "linkedin", "LINKEDIN"),
    twitter: pick(raw, "twitter", "TWITTER"),
    instagram: pick(raw, "instagram", "INSTAGRAM"),
    youtube: pick(raw, "youtube", "YOUTUBE"),
    facebook: pick(raw, "facebook", "FACEBOOK"),
    website: pick(raw, "website", "WEBSITE"),
    phone: pick(raw, "phone", "PHONE"),
    sales_summary: pick(
      raw,
      "sales_summary",
      "SALES_SUMMARY",
      "place_sales_summary",
      "PLACE_SALES_SUMMARY",
    ),
    phone_carrier: pick(raw, "phone_carrier", "PHONE_CARRIER"),
  });
}

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();
  const overwriteFb =
    process.env.ENRICH_OVERWRITE_FACEBOOK === "1" ||
    process.env.ENRICH_OVERWRITE_FACEBOOK === "true";

  const { data: jobs, error: qErr } = await supabase
    .from("enrichment_jobs")
    .select("id, task_id, status, loaded_at")
    .eq("status", "completed")
    .is("loaded_at", null);

  if (qErr) {
    throw new Error(qErr.message);
  }

  if (!jobs?.length) {
    console.log("enrich-pipeline: no completed enrichment jobs awaiting load.");
    return;
  }

  let updatedRows = 0;
  let jobsDone = 0;

  for (const job of jobs) {
    try {
      const rows = await fetchAllTaskResults(job.task_id);

      const parsed = [];
      for (const raw of rows) {
        const placeId = pick(raw, "place_id", "PLACE_ID");
        if (!placeId) {
          console.error("enrich-pipeline: skip row without place_id");
          continue;
        }
        parsed.push({
          placeId,
          contact_enrichment: rawToContactEnrichment(raw, job.task_id),
          fb: pickFacebookUrl(raw),
        });
      }

      let hasFbSet = new Set();
      if (!overwriteFb && parsed.length > 0) {
        const ids = parsed.map((p) => p.placeId);
        const { data: existing } = await supabase
          .from("businesses")
          .select("place_id, facebook_url")
          .in("place_id", ids);
        for (const ex of existing ?? []) {
          if (ex.facebook_url && String(ex.facebook_url).trim()) {
            hasFbSet.add(ex.place_id);
          }
        }
      }

      const enrichedAt = new Date().toISOString();
      const payloads = [];
      for (const p of parsed) {
        const row = {
          place_id: p.placeId,
          contact_enrichment: p.contact_enrichment,
          enriched_at: enrichedAt,
        };
        if (p.fb && (overwriteFb || !hasFbSet.has(p.placeId))) {
          row.facebook_url = p.fb;
        }
        payloads.push(omitUndefined(row));
      }

      for (let i = 0; i < payloads.length; i += BATCH) {
        const chunk = payloads.slice(i, i + BATCH);
        const { error: upErr } = await supabase.from("businesses").upsert(chunk, {
          onConflict: "place_id",
        });
        if (upErr) {
          console.error("enrich-pipeline: upsert batch:", upErr.message);
          continue;
        }
        updatedRows += chunk.length;
      }

      const { error: loadErr } = await supabase
        .from("enrichment_jobs")
        .update({ loaded_at: new Date().toISOString() })
        .eq("id", job.id);

      if (loadErr) {
        console.error(`enrich-pipeline: loaded_at job ${job.id}:`, loadErr.message);
      } else {
        jobsDone += 1;
      }
    } catch (e) {
      console.error(`enrich-pipeline: job ${job.id} task ${job.task_id}:`, e.message ?? e);
    }
  }

  console.log(
    `enrich-pipeline: updated ~${updatedRows} business row(s), marked ${jobsDone} job(s) loaded.`,
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
