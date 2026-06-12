"use server";

import { revalidatePath } from "next/cache";
import { normalizePhoneE164 } from "@/lib/phone-lookup";
import { getTwilioProfilePublic } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateTwilioCredentials } from "@/lib/twilio-credentials";

export async function updateTwilioSettings(input: {
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  forwarding_number: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const accountSid = input.twilio_account_sid.trim();
  const authTokenInput = input.twilio_auth_token.trim();
  const twilioPhoneRaw = input.twilio_phone_number.trim();
  const forwardingRaw = input.forwarding_number.trim();

  const existing = await getTwilioProfilePublic(user.id);
  const authToken =
    authTokenInput.length > 0
      ? authTokenInput
      : existing.has_twilio_auth_token
        ? await getStoredAuthToken(user.id)
        : "";

  const clearing =
    !accountSid && !authTokenInput && !twilioPhoneRaw && !forwardingRaw;

  if (clearing) {
    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("profiles")
      .update({
        twilio_account_sid: null,
        twilio_auth_token: null,
        twilio_phone_number: null,
        forwarding_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/dashboard/settings");
    return { ok: true };
  }

  if (!accountSid) {
    return { ok: false, error: "Account SID is required" };
  }
  if (!authToken) {
    return { ok: false, error: "Auth token is required" };
  }

  const twilioPhoneNumber = normalizePhoneE164(twilioPhoneRaw, "US");
  if (!twilioPhoneNumber) {
    return { ok: false, error: "Twilio phone number must be a valid E.164 number" };
  }

  const forwardingNumber = normalizePhoneE164(forwardingRaw, "US");
  if (!forwardingNumber) {
    return { ok: false, error: "Forwarding number must be a valid E.164 number" };
  }

  const validation = await validateTwilioCredentials(
    accountSid,
    authToken,
    twilioPhoneNumber,
  );
  if (!validation.ok) {
    return validation;
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      twilio_account_sid: accountSid,
      twilio_auth_token: authToken,
      twilio_phone_number: twilioPhoneNumber,
      forwarding_number: forwardingNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

async function getStoredAuthToken(userId: string): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("twilio_auth_token")
    .eq("id", userId)
    .maybeSingle();

  return typeof data?.twilio_auth_token === "string" ? data.twilio_auth_token.trim() : "";
}
