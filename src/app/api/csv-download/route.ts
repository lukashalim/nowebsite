import { NextResponse } from "next/server";
import { z } from "zod";
import { addContactToList } from "@/lib/sendfox";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvDownloadSchema = z.object({
  email: z.email(),
  pageUrl: z.string().min(1).max(500),
  mode: z.literal("page"),
});

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
    const legacyFull =
      typeof body === "object" &&
      body !== null &&
      (body as { mode?: string }).mode === "full";
    if (legacyFull) {
      return NextResponse.json(
        { error: "Full directory CSV export is not available" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, pageUrl } = parsed.data;

  try {
    await addContactToList(email);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to subscribe email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await logCsvDownload(email, pageUrl);

  return NextResponse.json({ ok: true });
}
