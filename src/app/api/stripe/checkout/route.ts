import { NextResponse } from "next/server";
import { getSiteOrigin } from "@/lib/site-url";
import { getStripe, getStripePriceId } from "@/lib/stripe";
import { getUserProfile, isPro } from "@/lib/subscription";
import { CRM_BASE_PATH } from "@/lib/crm-path";
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
    if (isPro(profile)) {
      return NextResponse.redirect(`${getSiteOrigin()}${CRM_BASE_PATH}`, 303);
    }

    const stripe = getStripe();
    const origin = getSiteOrigin();

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      success_url: `${origin}${CRM_BASE_PATH}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${CRM_BASE_PATH}?checkout=cancelled`,
      allow_promotion_codes: true,
    };

    if (profile?.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
