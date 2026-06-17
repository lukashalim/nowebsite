import { NextResponse } from "next/server";
import { z } from "zod";
import { syncSendFoxProfileForUser } from "@/lib/sendfox-profile-sync";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, PROFILE_TABLE } from "@/lib/usage-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().max(100),
  marketingOptIn: z.boolean(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (user.id !== body.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = normalizeEmail(body.email);
  const now = new Date().toISOString();
  const admin = createSupabaseAdmin();

  const { error: profileError } = await admin
    .from(PROFILE_TABLE)
    .update({
      [PROFILE_COLUMNS.marketingOptIn]: body.marketingOptIn,
      email,
      updated_at: now,
    })
    .eq("id", body.userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!body.marketingOptIn) {
    return NextResponse.json({ ok: true, subscribed: false });
  }

  try {
    const result = await syncSendFoxProfileForUser(body.userId, email, {
      firstName: body.firstName.trim() || undefined,
    });
    return NextResponse.json({
      ok: true,
      subscribed: result.subscribed,
      confirmed: result.confirmed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SendFox subscription failed";
    console.error(`[sync-marketing] SendFox failed for ${body.userId}:`, error);
    return NextResponse.json({
      ok: true,
      subscribed: false,
      warning: message,
    });
  }
}
