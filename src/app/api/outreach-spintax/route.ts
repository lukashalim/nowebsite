import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildOutreachMessage,
  isEligibleForFacebookListingOutreach,
  shortenBusinessNameForOutreach,
  type FacebookOutreachRow,
} from "@/lib/outreach-spintax";
import { fetchSpintaxTemplatesForUser } from "@/lib/spintax-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OutreachDbRow extends FacebookOutreachRow {
  main_category: string | null;
  business_type: string | null;
}

export async function POST(req: Request) {
  try {
    const authSupabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const record =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

    const placeId =
      typeof record.placeId === "string" ? record.placeId.trim() : "";
    const templateId =
      typeof record.templateId === "string" ? record.templateId.trim() : "";
    const templateOverride =
      typeof record.template === "string" ? record.template : "";

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("businesses_nowebsite")
      .select(
        "place_id, name, facebook_url, crm_contact_surface, listing_website, main_category, business_type",
      )
      .eq("place_id", placeId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const outreachRow = row as OutreachDbRow;
    if (!isEligibleForFacebookListingOutreach(outreachRow)) {
      return NextResponse.json(
        {
          error:
            "This lead has no Facebook on their Google listing (or is WhatsApp-only). Spintax is only generated for Facebook-surface leads.",
        },
        { status: 400 },
      );
    }

    let templateText = templateOverride.trim();
    if (templateId && user) {
      const { templates, error: templatesError } =
        await fetchSpintaxTemplatesForUser(authSupabase, user.id);
      if (templatesError) {
        return NextResponse.json({ error: templatesError }, { status: 500 });
      }
      const match = templates.find((t) => t.id === templateId);
      if (!match) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      templateText = match.template;
    }

    if (!templateText) {
      if (!user) {
        return NextResponse.json({ error: "Sign in required" }, { status: 401 });
      }
      const { templates, error: templatesError } =
        await fetchSpintaxTemplatesForUser(authSupabase, user.id);
      if (templatesError) {
        return NextResponse.json({ error: templatesError }, { status: 500 });
      }
      templateText = templates[0]?.template ?? "";
    }

    if (!templateText) {
      return NextResponse.json({ error: "No spintax template available" }, {
        status: 404,
      });
    }

    const fullName = outreachRow.name?.trim() ?? "";
    const shortName = shortenBusinessNameForOutreach(outreachRow.name);
    const spintax = buildOutreachMessage(templateText, {
      name: outreachRow.name,
      mainCategory: outreachRow.main_category,
      businessType: outreachRow.business_type,
    });

    return NextResponse.json({
      spintax,
      shortName,
      fullName: fullName || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
