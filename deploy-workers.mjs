/**
 * Deploy sweatydata worker.mjs + env to ~/nowebsite on EC2.
 * Run from repo root: npm run deploy-workers  (or node deploy-workers.mjs)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KEY_PATH = resolve(__dirname, "gmaps_key.pem");
const INSTANCES_FILE = resolve(__dirname, "instances.json");
const LOCAL_WORKER = resolve(__dirname, "..", "sweatydata", "worker.mjs");
const REMOTE_DIR = "/home/ubuntu/nowebsite";
const REMOTE_WORKER = `${REMOTE_DIR}/worker.mjs`;
const REMOTE_ENV = `${REMOTE_DIR}/.env`;
const SSH_USER = "ubuntu";

const DISK_CLEAN_THRESHOLD_PCT = Number(
  process.env.DEPLOY_DISK_CLEAN_THRESHOLD_PCT ?? "60",
);
const DISK_CRITICAL_PCT = Number(process.env.DEPLOY_DISK_CRITICAL_PCT ?? "95");
const DEPLOY_CONCURRENCY = Math.max(
  1,
  Number.parseInt(String(process.env.DEPLOY_CONCURRENCY ?? "8"), 10) || 8,
);
const DEPLOY_BOTASAURUS_CLEAN =
  String(process.env.DEPLOY_BOTASAURUS_CLEAN ?? "1").trim() !== "0";

const SSH_OPTS = `-i "${KEY_PATH}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

function pickLocalEnvPath() {
  const candidates = [
    resolve(__dirname, ".env.local"),
    resolve(__dirname, ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error("Missing .env.local or .env in nowebsite/");
}

function run(command) {
  return new Promise((resolvePromise, rejectPromise) => {
    exec(command, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(new Error(`${error.message}\n${stderr || stdout}`.trim()));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

function parseRootUsePercent(dfStdout) {
  const lines = dfStdout.trim().split(/\n/).filter(Boolean);
  const dataLine = lines.find((l) => /^\//.test(l.trim())) ?? lines[1];
  if (!dataLine) return null;
  const m = dataLine.match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}

async function getRootDiskUsePercent(ip) {
  const { stdout } = await run(`ssh ${SSH_OPTS} ${SSH_USER}@${ip} df -P /`);
  return parseRootUsePercent(stdout);
}

function buildDiskCleanupScript() {
  const botasaurusBlock = DEPLOY_BOTASAURUS_CLEAN
    ? `
echo "[deploy] removing Botasaurus / scrape output and browser scratch (if present)…"
for d in \\
  "$HOME/.botasaurus" \\
  "$HOME/nowebsite/output" \\
  "$HOME/sweatydata/output" \\
  "$HOME/botasaurus/output" \\
  "$HOME/botasaurus/outputs" \\
  "/home/ubuntu/botasaurus/output" \\
  "/home/ubuntu/botasaurus/outputs" \\
  "/opt/botasaurus/output" \\
  "/opt/botasaurus/outputs" \\
  "$HOME/.cache/ms-playwright" \\
  "$HOME/.cache/puppeteer" \\
  "$HOME/.cache/chromium" \\
  "$HOME/.local/share/botasaurus"
do
  if [ -e "$d" ]; then
    echo "[deploy] rm -rf $d"
    sudo rm -rf "$d" 2>/dev/null || rm -rf "$d" 2>/dev/null || true
  fi
done
find /tmp -maxdepth 1 -mindepth 1 \\( -name 'botasaurus*' -o -name '.org.chromium.Chromium.*' -o -name 'scoped_dir*' \\) -print0 2>/dev/null | while IFS= read -r -d '' p; do
  echo "[deploy] rm -rf $p"
  sudo rm -rf "$p" 2>/dev/null || rm -rf "$p" 2>/dev/null || true
done
`
    : `
echo "[deploy] skipping Botasaurus dir cleanup (DEPLOY_BOTASAURUS_CLEAN=0)"
`;

  return `set +e
echo "[deploy] disk before cleanup:"
df -h /
sudo apt-get clean -y 2>/dev/null || true
sudo journalctl --vacuum-time=3d 2>/dev/null || true
${botasaurusBlock}
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  pm2 flush 2>/dev/null || true
fi
echo "[deploy] disk after cleanup:"
df -h /
`;
}

async function runRemoteDiskCleanup(ip) {
  const script = buildDiskCleanupScript();
  const b64 = Buffer.from(script, "utf8").toString("base64");
  await run(`ssh ${SSH_OPTS} ${SSH_USER}@${ip} "echo ${b64} | base64 -d | bash"`);
}

async function checkAndCleanDiskIfNeeded(ip) {
  let pct;
  try {
    pct = await getRootDiskUsePercent(ip);
  } catch (e) {
    console.warn(`[disk] ${ip}: could not read df (${e.message ?? e}). Continuing deploy.`);
    return { pct: null, cleaned: false };
  }

  if (pct == null || Number.isNaN(pct)) {
    console.warn(`[disk] ${ip}: could not parse disk use. Continuing deploy.`);
    return { pct: null, cleaned: false };
  }

  console.log(`[disk] ${ip}: root filesystem ~${pct}% used`);

  if (pct < DISK_CLEAN_THRESHOLD_PCT) {
    return { pct, cleaned: false };
  }

  console.log(
    `[disk] ${ip}: >= ${DISK_CLEAN_THRESHOLD_PCT}% — running cleanup (apt, journal, ${
      DEPLOY_BOTASAURUS_CLEAN ? "Botasaurus/browser dirs, " : ""
    }pm2 flush)…`,
  );
  try {
    await runRemoteDiskCleanup(ip);
  } catch (e) {
    console.warn(`[disk] ${ip}: cleanup failed (${e.message ?? e}). Continuing deploy.`);
    return { pct, cleaned: false };
  }

  let after = pct;
  try {
    after = await getRootDiskUsePercent(ip);
  } catch {
    /* keep pct */
  }

  if (after != null && after >= DISK_CRITICAL_PCT) {
    console.warn(
      `[disk] ${ip}: still ~${after}% after cleanup. Consider a larger volume or cleaning caches.`,
    );
  } else if (after != null) {
    console.log(`[disk] ${ip}: after cleanup ~${after}% used`);
  }

  return { pct: after ?? pct, cleaned: true };
}

function loadInstanceIps() {
  const raw = readFileSync(INSTANCES_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("instances.json must contain an array.");
  }
  const ips = parsed
    .map((row) => String(row.publicIp ?? row.ip ?? "").trim())
    .filter(Boolean);
  return [...new Set(ips)];
}

async function deployToInstance(ip, localEnvPath) {
  const mkdirCmd = `ssh ${SSH_OPTS} ${SSH_USER}@${ip} "mkdir -p ${REMOTE_DIR}"`;
  const scpWorkerCmd = `scp -i "${KEY_PATH}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${LOCAL_WORKER}" ${SSH_USER}@${ip}:${REMOTE_WORKER}`;
  const scpEnvCmd = `scp -i "${KEY_PATH}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${localEnvPath}" ${SSH_USER}@${ip}:${REMOTE_ENV}`;
  const restartCmd = `ssh -i "${KEY_PATH}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${SSH_USER}@${ip} "bash -lc 'export NVM_DIR=$HOME/.nvm && [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" && pm2 stop zip-worker || true && pm2 delete zip-worker || true && cd ${REMOTE_DIR} && pm2 start worker.mjs --name zip-worker --cwd ${REMOTE_DIR} && pm2 save'"`;

  try {
    await checkAndCleanDiskIfNeeded(ip);
    await run(mkdirCmd);
    await run(scpWorkerCmd);
    await run(scpEnvCmd);
    await run(restartCmd);
    console.log(`[OK] ${ip} deployed to ${REMOTE_DIR} and pm2 restarted`);
    return { ip, ok: true };
  } catch (err) {
    console.error(`[FAIL] ${ip}: ${err.message ?? err}`);
    return { ip, ok: false, error: String(err.message ?? err) };
  }
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function poolWorker() {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => poolWorker(),
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Missing SSH key: ${KEY_PATH}`);
    process.exit(1);
  }
  if (!existsSync(LOCAL_WORKER)) {
    console.error(
      `Missing worker source: ${LOCAL_WORKER}\nClone or keep sweatydata next to nowebsite.`,
    );
    process.exit(1);
  }

  const localEnvPath = pickLocalEnvPath();

  let ips;
  try {
    ips = loadInstanceIps();
  } catch (err) {
    console.error(`Failed to read instances.json: ${err.message ?? err}`);
    process.exit(1);
  }

  if (ips.length === 0) {
    console.error("No instance IPs found in instances.json");
    process.exit(1);
  }

  console.log(
    `Deploying worker from sweatydata → ${REMOTE_DIR} on ${ips.length} instance(s) (concurrency=${DEPLOY_CONCURRENCY})…`,
  );
  const results = await mapPool(ips, DEPLOY_CONCURRENCY, (ip) =>
    deployToInstance(ip, localEnvPath),
  );

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  console.log(`Done. Success: ${okCount}, Failed: ${failCount}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
