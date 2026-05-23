import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  pageUrl: z.string().trim().min(1).max(2048),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid email or page URL.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const { email, pageUrl } = parsed.data;

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("csv_downloads").insert({
      email: email.toLowerCase(),
      page_url: pageUrl,
      downloaded_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[csv-download] insert failed:", error.message);
      return NextResponse.json(
        { ok: false, error: "Could not save your request. Try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error.";
    console.error("[csv-download]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
