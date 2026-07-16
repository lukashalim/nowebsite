import { NextResponse } from "next/server";
import { demoPathSegment } from "@/lib/demo-slug";
import { DEMO_DETAIL_COLUMNS } from "@/lib/crm-cohort";
import { recordCrmUsage } from "@/lib/crm-usage";
import { createLobPostcard, isLobTestMode } from "@/lib/lob";
import {
  isMailableLeadAddress,
  leadToLobAddress,
  parseReturnAddressFromEnv,
} from "@/lib/postcard/address";
import { buildPostcardBackHtml } from "@/lib/postcard/back-html";
import { ensurePostcardFrontUrl } from "@/lib/postcard/capture";
import { demoUrlToQrDataUri } from "@/lib/postcard/qr";
import { ensureProfileUsername } from "@/lib/profile-username";
import { ringReadyTenantDemoUrl } from "@/lib/ringready-site";
import { getUserProfile } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    force?: boolean;
    ownerName?: string | null;
  };
  try {
    body = (await request.json()) as {
      placeId?: string;
      force?: boolean;
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

  let from;
  try {
    from = parseReturnAddressFromEnv();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "RETURN_ADDRESS is misconfigured",
      },
      { status: 500 },
    );
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
  const ownerName = body.ownerName?.trim() || null;

  if (!isMailableLeadAddress({ address, city, state, postal_code })) {
    return NextResponse.json(
      {
        error:
          "Lead needs a complete street address, city, state, and ZIP to mail.",
      },
      { status: 400 },
    );
  }

  const slug = demoPathSegment({
    place_id: placeId,
    demo_slug: typeof row.demo_slug === "string" ? row.demo_slug : null,
  });
  const liveDemoUrl = ringReadyTenantDemoUrl(
    username,
    decodeURIComponent(slug),
  );
  const captureUrl = `${liveDemoUrl}${liveDemoUrl.includes("?") ? "&" : "?"}postcard=1`;

  let frontUrl: string;
  try {
    frontUrl = await ensurePostcardFrontUrl({
      username,
      placeId,
      captureUrl,
      force: body.force === true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Screenshot failed: ${err.message}`
            : "Screenshot failed",
      },
      { status: 502 },
    );
  }

  let qrDataUri: string;
  try {
    qrDataUri = await demoUrlToQrDataUri(liveDemoUrl);
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

  const backHtml = buildPostcardBackHtml({
    businessName: name?.trim() || "your business",
    qrDataUri,
    demoUrl: liveDemoUrl,
  });

  const to = leadToLobAddress({
    name,
    ownerName,
    address: address!,
    city: city!,
    state: state!,
    postal_code: postal_code!,
    country,
  });

  let postcard;
  try {
    postcard = await createLobPostcard({
      description: `CRM postcard for ${name ?? placeId}`,
      to,
      from,
      front: frontUrl,
      back: backHtml,
      size: "4x6",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Lob create failed",
      },
      { status: 502 },
    );
  }

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

  return NextResponse.json({
    ok: true,
    postcardId: postcard.id,
    url: postcard.url,
    expectedDeliveryDate: postcard.expected_delivery_date,
    testMode: isLobTestMode(),
    remaining: usage.remaining,
    frontUrl,
    demoUrl: liveDemoUrl,
  });
}
