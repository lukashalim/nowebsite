import { NextResponse } from "next/server";
import { z } from "zod";
import { createCsvDownloadToken } from "@/lib/csv-download-token";
import { buildDirectoryExport } from "@/lib/directory/build-export";
import { addContactToList } from "@/lib/sendfox";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvDownloadSchema = z.discriminatedUnion("mode", [
  z.object({
    email: z.email(),
    pageUrl: z.string().min(1).max(500),
    mode: z.literal("page"),
  }),
  z.object({
    email: z.email(),
    pageUrl: z.string().min(1).max(500),
    mode: z.literal("full"),
    type: z.enum(["category", "state", "facebook"]),
    slug: z.string().min(1).max(100).optional(),
  }),
]);

async function logCsvDownload(email: string, pageUrl: string): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();
    await supabase.from("csv_downloads").insert({ email, page_url: pageUrl });
  } catch {
    // Non-blocking: SendFox subscription is the gate; logging is best-effort.
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = csvDownloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, pageUrl, mode } = parsed.data;

  try {
    await addContactToList(email);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to subscribe email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await logCsvDownload(email, pageUrl);

  if (mode === "page") {
    return NextResponse.json({ ok: true });
  }

  const { type, slug } = parsed.data;
  if (type !== "facebook" && !slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const exportResult = await buildDirectoryExport(type, slug);
  if (!exportResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = createCsvDownloadToken(email, type, slug);

  return new NextResponse(exportResult.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Csv-Download-Token": token,
    },
  });
}
