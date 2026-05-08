import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

let didLoad = false;

/**
 * Ensures env vars from the repo root `.env.local` are on
 * `process.env`. Next may reset env after `next.config` runs; loading here is
 * reliable for server-only code (Server Components, Server Actions).
 */
export function loadSharedEnvLocal(): void {
  if (didLoad) return;
  didLoad = true;

  const candidates = [
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    loadDotenv({ path: p, override: false });
  }
}
