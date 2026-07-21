import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildOutreachMessage,
  isEligibleForCrmSpintax,
  shortenBusinessNameForOutreach,
  type FacebookOutreachRow,
} from "@/lib/outreach-spintax";
import type { CrmWebPresence } from "@/lib/crm-params";
import { recordCrmUsage } from "@/lib/crm-usage";
import {
  filterSpintaxTemplatesForLeadChannel,
  leadSpintaxAudience,
  templateMatchesLeadAudience,
} from "@/lib/spintax-audience";
import { getUserProfile, isPro } from "@/lib/subscription";
import { fetchSpintaxTemplatesForUser } from "@/lib/spintax-templates";
import {
  TEST_LEAD_BLOCKED_MESSAGE,
  shouldBlockTestLead,
} from "@/lib/crm-test-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OutreachDbRow extends FacebookOutreachRow {
  main_category: string | null;
  business_type: string | null;
  has_website: boolean | null;
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
    const webPresenceRaw =
      typeof record.webPresence === "string" ? record.webPresence.trim() : "all";
    const webPresence = (
      ["all", "no", "plain", "facebook", "whatsapp", "yes"] as const
    ).includes(webPresenceRaw as CrmWebPresence)
      ? (webPresenceRaw as CrmWebPresence)
      : "all";
    const allowTest = record.allowTest === true;

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!isPro(profile)) {
      const usage = await recordCrmUsage(user.id, profile, "dm", placeId);
      if (!usage.ok) {
        return NextResponse.json({ error: usage.error }, { status: 403 });
      }
    }

    const supabase = createSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("businesses_nowebsite")
      .select(
        "place_id, name, facebook_url, crm_contact_surface, listing_website, main_category, business_type, has_website, is_test",
      )
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

    const outreachRow = row as OutreachDbRow;
    const effectiveWebPresence: CrmWebPresence =
      outreachRow.has_website === true ? "yes" : webPresence;
    if (!isEligibleForCrmSpintax(effectiveWebPresence, outreachRow)) {
      return NextResponse.json(
        {
          error:
            "Spintax is only available for no-website leads (Has website = No).",
        },
        { status: 400 },
      );
    }

    const leadAudience = leadSpintaxAudience(outreachRow);

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
      if (match.channel !== "facebook") {
        return NextResponse.json(
          { error: "Template is not a Facebook DM template" },
          { status: 400 },
        );
      }
      if (!templateMatchesLeadAudience(match.audience, leadAudience)) {
        return NextResponse.json(
          { error: "Template does not match this lead type" },
          { status: 400 },
        );
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
      const matching = filterSpintaxTemplatesForLeadChannel(
        templates,
        "facebook",
        leadAudience,
      );
      templateText = matching[0]?.template ?? "";
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
