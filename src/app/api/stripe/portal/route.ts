import { NextResponse } from "next/server";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { getSiteOrigin } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { getUserProfile } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    const customerId = profile?.stripe_customer_id?.trim();
    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found for this user" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const origin = getSiteOrigin();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}${CRM_BASE_PATH}`,
    });

    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Billing portal failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
