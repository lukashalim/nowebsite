import { NextResponse } from "next/server";
import { demoPathSegment } from "@/lib/demo-slug";
import { ringReadyTenantDemoUrl } from "@/lib/ringready-site";
import { recordCrmUsage } from "@/lib/crm-usage";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { DEMO_DETAIL_COLUMNS } from "@/lib/crm-cohort";
import { ensureProfileUsername } from "@/lib/profile-username";
import { getUserProfile, isPro } from "@/lib/subscription";
import { materializeTenantLeadByPlaceId } from "@/lib/tenant-lead-sync";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TEST_LEAD_BLOCKED_MESSAGE,
  shouldBlockTestLead,
} from "@/lib/crm-test-lead";

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
  const allowTest =
    searchParams.get("allowTest") === "1" ||
    searchParams.get("allowTest") === "true";

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const profile = await getUserProfile(user.id);
  const username =
    profile?.username?.trim() ||
    (await ensureProfileUsername(
      user.id,
      profile?.email ?? user.email ?? "",
    ));
  if (!username) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?setup=username", request.url),
    );
  }

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("businesses_nowebsite")
    .select(`${DEMO_DETAIL_COLUMNS}, is_test`)
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (shouldBlockTestLead(row.is_test, allowTest)) {
    return NextResponse.json(
      { error: TEST_LEAD_BLOCKED_MESSAGE },
      { status: 403 },
    );
  }

  await materializeTenantLeadByPlaceId(user.id, placeId).catch(() => {});

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

  const slug = demoPathSegment({
    place_id: String(row.place_id),
    demo_slug:
      typeof row.demo_slug === "string" ? row.demo_slug : null,
  });

  return NextResponse.redirect(
    ringReadyTenantDemoUrl(username, decodeURIComponent(slug)),
  );
}
