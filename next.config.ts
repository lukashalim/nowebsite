import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = appDir;

/** Repo root `.env.local` (may be overwritten when Next resets `process.env`). */
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  // Allow concurrent `next dev` for CRM (:3000) and RingReady (:3001).
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
};

export default nextConfig;
