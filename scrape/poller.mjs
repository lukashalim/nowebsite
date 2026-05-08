/**
 * Sync scrape_jobs status with Botasaurus task status.
 *
 * Default: one sync pass.
 * Watch mode: `node poller.mjs --watch`
 */
import dns from "node:dns";
import {
  botasaurusFetch,
  getBotasaurusBase,
  getSupabase,
  loadEnvLocal,
  sleep,
} from "./lib/scrape-pipeline/index.mjs";

dns.setDefaultResultOrder("ipv4first");

const WATCH = process.argv.includes("--watch");
const POLL_MS = Number.parseInt(process.env.POLL_MS ?? "30000", 10) || 30000;
const SCRAPE_JOBS_TABLE = process.env.SCRAPE_JOBS_TABLE ?? "scrape_jobs";
const PAGE_SIZE = 1000;

function normalizeStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  return s;
}

async function syncOnce(supabase, base) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(SCRAPE_JOBS_TABLE)
      .select("id, task_id, status, loaded_at")
      .is("loaded_at", null)
      .in("status", ["pending", "in_progress", "completed"])
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`list jobs failed: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  if (!rows.length) {
    return { checked: 0, changed: 0, byStatus: {}, remainingActive: 0 };
  }

  let changed = 0;
  let remainingActive = 0;
  const byStatus = {};

  for (const row of rows) {
    try {
      const res = await botasaurusFetch(`${base}/tasks/${row.task_id}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const task = await res.json();
      const apiStatus = normalizeStatus(task?.status);
      byStatus[apiStatus] = (byStatus[apiStatus] ?? 0) + 1;

      if (apiStatus === "pending" || apiStatus === "in_progress") {
        remainingActive += 1;
      }

      if (apiStatus !== normalizeStatus(row.status)) {
        const { error: upErr } = await supabase
          .from(SCRAPE_JOBS_TABLE)
          .update({ status: apiStatus })
          .eq("id", row.id);
        if (upErr) {
          console.error(
            `[poller] update failed id=${row.id} task=${row.task_id}: ${upErr.message}`,
          );
        } else {
          changed += 1;
        }
      }
    } catch (e) {
      console.error(
        `[poller] task check failed id=${row.id} task=${row.task_id}: ${e.message ?? e}`,
      );
    }
  }

  return { checked: rows.length, changed, byStatus, remainingActive };
}

async function main() {
  loadEnvLocal();
  const supabase = getSupabase();
  const base = getBotasaurusBase();
  console.log(
    `[poller] table=${SCRAPE_JOBS_TABLE} base=${base} mode=${WATCH ? "watch" : "once"}`,
  );

  for (;;) {
    const summary = await syncOnce(supabase, base);
    console.log(
      `[poller] checked=${summary.checked} changed=${summary.changed} active=${summary.remainingActive} statuses=${JSON.stringify(summary.byStatus)}`,
    );

    if (!WATCH || summary.remainingActive === 0) {
      break;
    }
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

