import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = appDir;

/** Repo root `.env.local` (may be overwritten when Next resets `process.env`). */
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {};

export default nextConfig;
