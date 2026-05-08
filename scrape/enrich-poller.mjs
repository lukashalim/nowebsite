/**
 * Poll Botasaurus for pending enrichment_jobs until tasks reach a terminal status.
 * Uses BOTASAURUS_URL + BOTASAURUS_AUTH_TOKEN / GOOGLE_MAPS_EXTRACTOR_KEY like other scripts.
 */
import dns from "node:dns";
import {
  getBotasaurusBase,
  loadEnvLocal,
  getSupabase,
  sleep,
  botasaurusFetch,
} from "./lib/scrape-pipeline/index.mjs";

/** Reduces Windows/Node "fetch failed" when IPv6 is broken but IPv4 works. */
dns.setDefaultResultOrder("ipv4first");

const TERMINAL = new Set(["completed", "failed", "aborted"]);
const POLL_MS = Number.parseInt(process.env.ENRICH_POLL_MS ?? "30000", 10) || 30000;

function formatNetErr(err, url) {
  const c = err?.cause;
  const bits = [err?.message ?? String(err), `url=${url}`];
  if (c?.code) bits.push(`code=${c.code}`);
  if (c?.syscall) bits.push(`syscall=${c.syscall}`);
  if (c?.code === "ETIMEDOUT" && c?.syscall === "connect") {
    bits.push(
      "hint=TCP to Botasaurus never connected (SG inbound :8000, correct public IP, listen 0.0.0.0:8000 on host)",
    );
  }
  return bits.join(" | ");
}

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();
  const base = getBotasaurusBase();
  console.error(`[enrich-poller] Botasaurus base: ${base}`);

  while (true) {
    const { data: pending, error } = await supabase
      .from("enrichment_jobs")
      .select("id, task_id, status")
      .eq("status", "pending");

    if (error) {
      console.error("enrich-poller: list failed:", error.message);
      await sleep(POLL_MS);
      continue;
    }

    if (!pending?.length) {
      console.log("No pending enrichment_jobs.");
      break;
    }

    for (const job of pending) {
      try {
        const url = `${base}/tasks/${job.task_id}`;
        const res = await botasaurusFetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const task = await res.json();
        const apiStatus = String(task.status ?? "unknown");

        console.log(`Enrichment task ${job.task_id}: ${apiStatus}`);

        if (TERMINAL.has(apiStatus)) {
          const { error: upErr } = await supabase
            .from("enrichment_jobs")
            .update({ status: apiStatus })
            .eq("id", job.id);
          if (upErr) {
            console.error(`enrich-poller: update job ${job.id}:`, upErr.message);
          }
        }
      } catch (err) {
        const url = `${base}/tasks/${job.task_id}`;
        console.error(
          `enrich-poller: job ${job.id} task ${job.task_id}:`,
          formatNetErr(err, url),
        );
      }
    }

    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
