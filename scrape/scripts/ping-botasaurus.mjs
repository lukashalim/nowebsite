/**
 * GET BOTASAURUS_URL with the same auth headers as dispatch/pipeline.
 * Usage (from scrape/): npm run ping-botasaurus
 */
import {
  loadEnvLocal,
  botasaurusFetch,
  getBotasaurusBase,
} from "../lib/scrape-pipeline/index.mjs";

loadEnvLocal();
const base = getBotasaurusBase();
const raw = process.argv[2] ?? "/";
const path = raw.startsWith("http")
  ? raw
  : raw.startsWith("/")
    ? raw
    : `/${raw}`;

function formatFetchError(err) {
  const lines = [err?.message ?? String(err)];
  let c = err?.cause;
  let depth = 0;
  while (c != null && depth < 6) {
    const bits = [
      c.code,
      c.errno != null ? `errno ${c.errno}` : null,
      c.syscall,
      c.address && c.port != null ? `${c.address}:${c.port}` : null,
    ].filter(Boolean);
    if (bits.length) lines.push(`  cause: ${bits.join(" ")}`);
    c = c.cause;
    depth += 1;
  }
  return lines.join("\n");
}

try {
  const target = path.startsWith("http") ? path : `${base}${path}`;
  console.error(`GET ${target}`);
  const res = await botasaurusFetch(path, {
    method: "GET",
  });
  const text = await res.text();
  const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  console.log(`${res.status} ${res.statusText} — ${target}`);
  if (preview) console.log(preview);
  process.exitCode = res.ok ? 0 : 1;
} catch (e) {
  console.error(formatFetchError(e));
  console.error(
    "\nECONNREFUSED: nothing listening on that public IP/port, or process bound to 127.0.0.1 only (listen on 0.0.0.0 for remote access).",
  );
  console.error(
    "ETIMEDOUT: route/firewall/NACL blocking, wrong IP, or host not reachable from this network.",
  );
  console.error(
    "On EC2: sudo ss -tlnp | grep 8000   and   curl -sS -o /dev/null -w '%{http_code}\\n' -H \"Authorization: Bearer …\" http://127.0.0.1:8000/",
  );
  process.exitCode = 1;
}
