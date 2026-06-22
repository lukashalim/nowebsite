import { NextResponse } from "next/server";
import type { ExtractStartOptions } from "@/lib/extract-local-runner-types";
import {
  getExtractRunnerSnapshot,
  startExtractLocal,
} from "@/lib/extract-local-runner";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const runtime = "nodejs";

function disabledResponse() {
  return NextResponse.json(
    { error: "Local admin is not enabled on this host." },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  if (!isLocalAdminEnabled(request.headers.get("host"))) return disabledResponse();
  return NextResponse.json(getExtractRunnerSnapshot());
}

export async function POST(request: Request) {
  if (!isLocalAdminEnabled(request.headers.get("host"))) return disabledResponse();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const countryRaw =
    typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
  const country =
    countryRaw === "GB" || countryRaw === "US" || countryRaw === "AU"
      ? (countryRaw as "US" | "GB" | "AU")
      : undefined;

  const options: ExtractStartOptions = {
    businessType:
      typeof body.businessType === "string" ? body.businessType : undefined,
    country,
    locationHint:
      typeof body.locationHint === "string" ? body.locationHint : undefined,
    dryRun: body.dryRun === true,
    keepFiles: body.keepFiles === true,
    includeTasks: body.includeTasks === true,
    maxFiles:
      typeof body.maxFiles === "number" && Number.isFinite(body.maxFiles)
        ? body.maxFiles
        : typeof body.maxFiles === "string" && body.maxFiles.trim() !== ""
          ? Number.parseInt(body.maxFiles, 10)
          : undefined,
  };

  const result = startExtractLocal(options);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    ...getExtractRunnerSnapshot(),
  });
}
