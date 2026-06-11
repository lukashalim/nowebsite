import { NextResponse } from "next/server";
import { demoPublicPath } from "@/lib/demo-slug";
import { recordCrmUsage } from "@/lib/crm-usage";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim() ?? "";

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("businesses_nowebsite")
    .select("place_id, demo_slug")
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const profile = await getUserProfile(user.id);
  if (!isPro(profile)) {
    const usage = await recordCrmUsage(
      user.id,
      profile,
      "demo_click",
      placeId,
    );
    if (!usage.ok) {
      const redirectUrl = new URL(CRM_BASE_PATH, request.url);
      redirectUrl.searchParams.set("limit", "outreach");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const demoPath = demoPublicPath({
    place_id: String(row.place_id),
    demo_slug:
      typeof row.demo_slug === "string" ? row.demo_slug : null,
  });

  return NextResponse.redirect(new URL(demoPath, request.url));
}
