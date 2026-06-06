import { NextResponse } from "next/server";
import {
  classifyTwilioLineType,
  normalizePhoneE164,
  type PhoneCountry,
  type PhoneLineClassification,
} from "@/lib/phone-lookup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LookupPhoneSuccess {
  ok: true;
  e164: string;
  classification: PhoneLineClassification;
}

interface LookupPhoneFailure {
  ok: false;
  reason: "invalid_phone" | "not_configured" | "lookup_failed";
}

type LookupPhoneResponse = LookupPhoneSuccess | LookupPhoneFailure;

interface TwilioLineTypeIntelligence {
  type?: string | null;
  error_code?: string | null;
}

interface TwilioLookupResponse {
  valid?: boolean;
  phone_number?: string;
  line_type_intelligence?: TwilioLineTypeIntelligence | null;
}

function parseCountry(value: unknown): PhoneCountry | null | undefined {
  if (value === "US" || value === "GB" || value === "AU") return value;
  if (value === null || value === undefined || value === "") return undefined;
  return null;
}

function twilioAuthHeader(accountSid: string, authToken: string): string {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${credentials}`;
}

export async function POST(req: Request) {
  try {
    const authSupabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

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

    const phone = typeof record.phone === "string" ? record.phone.trim() : "";
    const country = parseCountry(record.country);

    if (!phone) {
      return NextResponse.json(
        { ok: false, reason: "invalid_phone" } satisfies LookupPhoneFailure,
        { status: 400 },
      );
    }

    if (country === null) {
      return NextResponse.json(
        { ok: false, reason: "invalid_phone" } satisfies LookupPhoneFailure,
        { status: 400 },
      );
    }

    const e164 = normalizePhoneE164(phone, country);
    if (!e164) {
      return NextResponse.json(
        { ok: false, reason: "invalid_phone" } satisfies LookupPhoneFailure,
        { status: 400 },
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { ok: false, reason: "not_configured" } satisfies LookupPhoneFailure,
        { status: 503 },
      );
    }

    const lookupUrl = new URL(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}`,
    );
    lookupUrl.searchParams.set("Fields", "line_type_intelligence");

    const twilioRes = await fetch(lookupUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: twilioAuthHeader(accountSid, authToken),
      },
      cache: "no-store",
    });

    if (!twilioRes.ok) {
      return NextResponse.json({
        ok: true,
        e164,
        classification: "unknown",
      } satisfies LookupPhoneSuccess);
    }

    let twilioData: TwilioLookupResponse;
    try {
      twilioData = (await twilioRes.json()) as TwilioLookupResponse;
    } catch {
      return NextResponse.json({
        ok: true,
        e164,
        classification: "unknown",
      } satisfies LookupPhoneSuccess);
    }

    if (twilioData.valid === false) {
      return NextResponse.json(
        { ok: false, reason: "invalid_phone" } satisfies LookupPhoneFailure,
        { status: 400 },
      );
    }

    const lineType = twilioData.line_type_intelligence?.type;
    if (!lineType || twilioData.line_type_intelligence?.error_code) {
      return NextResponse.json({
        ok: true,
        e164: twilioData.phone_number ?? e164,
        classification: "unknown",
      } satisfies LookupPhoneSuccess);
    }

    return NextResponse.json({
      ok: true,
      e164: twilioData.phone_number ?? e164,
      classification: classifyTwilioLineType(lineType),
    } satisfies LookupPhoneSuccess);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "lookup_failed" } satisfies LookupPhoneFailure,
      { status: 500 },
    );
  }
}
