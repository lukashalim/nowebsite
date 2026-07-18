import { NextResponse } from "next/server";
import { suggestOwnerNameFromReviews } from "@/app/actions/suggest-owner-name";
import { demoPathSegment } from "@/lib/demo-slug";
import { DEMO_DETAIL_COLUMNS } from "@/lib/crm-cohort";
import {
  canUseCrmOutreach,
  getCrmUsageSummary,
  recordCrmUsage,
} from "@/lib/crm-usage";
import { logUsageEvent } from "@/lib/log-usage-event";
import {
  createLobPostcard,
  isAcceptableUsDeliverability,
  isLobTestMode,
  verifyUsAddress,
  waitForLobPostcardProof,
  type LobAddress,
} from "@/lib/lob";
import {
  isMailableLeadAddress,
  leadToLobAddress,
} from "@/lib/postcard/address";
import { buildPostcardBackHtml } from "@/lib/postcard/back-html";
import { buildPostcardFrontHtml } from "@/lib/postcard/front-html";
import { assertCanSendPostcard } from "@/lib/postcard/limits";
import { uploadPostcardQrPublicUrl } from "@/lib/postcard/qr";
import { buildPostcardScanUrl } from "@/lib/postcard/scan-link";
import { ensureProfileUsername } from "@/lib/profile-username";
import { ringReadyTenantDemoUrl } from "@/lib/ringready-site";
import {
  getUserLobApiKey,
  getUserPostcardReturnAddress,
  getUserPostcardReturnStored,
  getUserProfile,
  getUserTwilioCredentials,
  isPro,
} from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: {
    placeId?: string;
    ownerName?: string | null;
  };
  try {
    body = (await request.json()) as {
      placeId?: string;
      ownerName?: string | null;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const placeId = body.placeId?.trim() ?? "";
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
    return NextResponse.json(
      { error: "Set a username in Settings before sending postcards." },
      { status: 400 },
    );
  }

  const lobApiKey = await getUserLobApiKey(user.id);
  if (!lobApiKey) {
    return NextResponse.json(
      {
        error:
          "Add your Lob API key in Settings before sending postcards.",
      },
      { status: 400 },
    );
  }

  const from = await getUserPostcardReturnAddress(user.id);
  if (!from) {
    return NextResponse.json(
      {
        error:
          "Add your return address in Settings before sending postcards.",
      },
      { status: 400 },
    );
  }

  const testMode = isLobTestMode(lobApiKey);

  const lifetime = await assertCanSendPostcard(user.id, testMode, {
    isPro: isPro(profile),
  });
  if (!lifetime.ok) {
    return NextResponse.json({ error: lifetime.error }, { status: 403 });
  }

  if (!testMode) {
    const usageSummary = await getCrmUsageSummary(user.id);
    if (!canUseCrmOutreach(profile, usageSummary.remaining)) {
      return NextResponse.json(
        {
          error:
            "Monthly outreach limit reached. Upgrade to Pro for unlimited DMs, SMS, demo links, and postcards.",
          remaining: 0,
        },
        { status: 402 },
      );
    }
  }

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("businesses_nowebsite")
    .select(`${DEMO_DETAIL_COLUMNS}, country`)
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const address = typeof row.address === "string" ? row.address : null;
  const city = typeof row.city === "string" ? row.city : null;
  const state = typeof row.state === "string" ? row.state : null;
  const postal_code =
    typeof row.postal_code === "string" ? row.postal_code : null;
  const country = typeof row.country === "string" ? row.country : null;
  const name = typeof row.name === "string" ? row.name : null;
  const category =
    (typeof row.main_category === "string" && row.main_category.trim()
      ? row.main_category
      : null) ||
    (typeof row.business_type === "string" && row.business_type.trim()
      ? row.business_type
      : null);
  const rating = row.rating != null ? Number(row.rating) : null;
  const reviewCount = row.reviews != null ? Number(row.reviews) : null;
  const phone = typeof row.phone === "string" ? row.phone : null;

  if (!isMailableLeadAddress({ address, city, state, postal_code })) {
    return NextResponse.json(
      {
        error:
          "Lead needs a complete street address, city, state, and ZIP to mail.",
      },
      { status: 400 },
    );
  }

  let ownerName = body.ownerName?.trim() || null;
  if (!ownerName) {
    const suggested = await suggestOwnerNameFromReviews(placeId);
    if (suggested.ok && suggested.ownerName?.trim()) {
      ownerName = suggested.ownerName.trim();
    }
  }

  const slugEncoded = demoPathSegment({
    place_id: placeId,
    demo_slug: typeof row.demo_slug === "string" ? row.demo_slug : null,
  });
  const slug = decodeURIComponent(slugEncoded);
  const liveDemoUrl = ringReadyTenantDemoUrl(username, slug);

  const frontHtml = buildPostcardFrontHtml({
    businessName: name?.trim() || "your business",
    category,
    city,
    state,
    rating: Number.isFinite(rating) ? rating : null,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : null,
    reviewHighlights: row.review_highlights,
    phone,
  });

  const scanUrl = buildPostcardScanUrl({
    userId: user.id,
    placeId,
    username,
    slug,
    isTest: testMode,
  });

  let qrImageUrl: string;
  try {
    qrImageUrl = await uploadPostcardQrPublicUrl({
      targetUrl: scanUrl,
      placeId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `QR generation failed: ${err.message}`
            : "QR generation failed",
      },
      { status: 500 },
    );
  }

  let backHtml: string;
  try {
    const storedReturn = await getUserPostcardReturnStored(user.id);
    const twilio = await getUserTwilioCredentials(user.id);
    const contactPhone =
      storedReturn?.contact_phone ||
      twilio?.phoneNumber ||
      twilio?.forwardingNumber ||
      null;
    backHtml = buildPostcardBackHtml({
      businessName: name?.trim() || "your business",
      qrImageUrl,
      contactPhone,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to build postcard back HTML",
      },
      { status: 500 },
    );
  }

  let to: LobAddress = leadToLobAddress({
    name,
    ownerName,
    address: address!,
    city: city!,
    state: state!,
    postal_code: postal_code!,
    country,
  });

  // Lob test_ keys do not verify real US addresses (always undeliverable unless
  // using Lob's fake primary_line/zip fixtures). Skip USAV gate in test mode.
  if (!testMode) {
    try {
      const verified = await verifyUsAddress(lobApiKey, {
        primary_line: to.address_line1,
        secondary_line: to.address_line2,
        city: to.address_city,
        state: to.address_state,
        zip_code: to.address_zip,
      });

      if (!isAcceptableUsDeliverability(verified.deliverability)) {
        return NextResponse.json(
          {
            error: `Address failed Lob deliverability check (${verified.deliverability}). Fix the street/city/state/ZIP, or set Lob account strictness to Normal/Relaxed.`,
            deliverability: verified.deliverability,
          },
          { status: 422 },
        );
      }

      to = {
        name: to.name,
        ...(to.company ? { company: to.company } : {}),
        address_line1: verified.primary_line,
        ...(verified.secondary_line
          ? { address_line2: verified.secondary_line }
          : {}),
        address_city: verified.city,
        address_state: verified.state.toUpperCase(),
        address_zip: verified.zip_code,
        address_country: "US",
      };
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Address verification failed: ${err.message}`
              : "Address verification failed",
        },
        { status: 502 },
      );
    }
  }

  let postcard;
  try {
    postcard = await createLobPostcard(lobApiKey, {
      description: `CRM postcard for ${name ?? placeId}`,
      to,
      from,
      front: frontHtml,
      back: backHtml,
      size: "4x6",
      useType: "marketing",
    });
    const proof = await waitForLobPostcardProof(lobApiKey, postcard.id);
    postcard = {
      ...postcard,
      url: proof.url ?? postcard.url,
      status: proof.status ?? postcard.status,
    };
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Lob create failed",
      },
      { status: 502 },
    );
  }

  let remaining: number | null = null;
  if (testMode) {
    const logged = await logUsageEvent(
      user.id,
      "postcard_sent_test",
      placeId,
    );
    if (!logged.ok) {
      return NextResponse.json(
        {
          error: logged.error,
          postcardId: postcard.id,
          url: postcard.url,
          warning: "Postcard was created but usage was not recorded.",
        },
        { status: 502 },
      );
    }
  } else {
    const usage = await recordCrmUsage(user.id, profile, "mail", placeId);
    if (!usage.ok) {
      return NextResponse.json(
        {
          error: usage.error,
          remaining: usage.remaining,
          postcardId: postcard.id,
          url: postcard.url,
          warning: "Postcard was created but usage was not recorded.",
        },
        { status: 402 },
      );
    }
    remaining = usage.remaining;
  }

  return NextResponse.json({
    ok: true,
    postcardId: postcard.id,
    url: postcard.url,
    expectedDeliveryDate: postcard.expected_delivery_date,
    testMode,
    remaining,
    demoUrl: liveDemoUrl,
    to,
  });
}
