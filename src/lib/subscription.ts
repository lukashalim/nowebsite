import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TwilioUserCredentials } from "@/lib/twilio-credentials";

export interface UserProfile {
  id: string;
  email: string | null;
  username: string | null;
  user_payment_link: string | null;
  is_pro: boolean;
  stripe_customer_id: string | null;
  subscription_price: string | null;
  subscription_started_at: string | null;
  sendfox_subscribed_at: string | null;
  sendfox_confirmed_at: string | null;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  forwarding_number: string | null;
}

export interface TwilioProfilePublic {
  twilio_account_sid: string;
  twilio_phone_number: string;
  forwarding_number: string;
  has_twilio_auth_token: boolean;
  is_active: boolean;
}

export function isPro(profile: UserProfile | null | undefined): boolean {
  return profile?.is_pro === true;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, username, user_payment_link, is_pro, stripe_customer_id, subscription_price, subscription_started_at, sendfox_subscribed_at, sendfox_confirmed_at, twilio_account_sid, twilio_phone_number, forwarding_number",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: String(data.id),
    email: typeof data.email === "string" ? data.email : null,
    username: typeof data.username === "string" ? data.username : null,
    user_payment_link:
      typeof data.user_payment_link === "string" ? data.user_payment_link : null,
    is_pro: data.is_pro === true,
    stripe_customer_id:
      typeof data.stripe_customer_id === "string"
        ? data.stripe_customer_id
        : null,
    subscription_price:
      typeof data.subscription_price === "string"
        ? data.subscription_price
        : null,
    subscription_started_at:
      typeof data.subscription_started_at === "string"
        ? data.subscription_started_at
        : null,
    sendfox_subscribed_at:
      typeof data.sendfox_subscribed_at === "string"
        ? data.sendfox_subscribed_at
        : null,
    sendfox_confirmed_at:
      typeof data.sendfox_confirmed_at === "string"
        ? data.sendfox_confirmed_at
        : null,
    twilio_account_sid:
      typeof data.twilio_account_sid === "string" ? data.twilio_account_sid : null,
    twilio_phone_number:
      typeof data.twilio_phone_number === "string"
        ? data.twilio_phone_number
        : null,
    forwarding_number:
      typeof data.forwarding_number === "string" ? data.forwarding_number : null,
  };
}

export async function getUserTwilioCredentials(
  userId: string,
): Promise<TwilioUserCredentials | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "twilio_account_sid, twilio_auth_token, twilio_phone_number, forwarding_number",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const accountSid =
    typeof data.twilio_account_sid === "string" ? data.twilio_account_sid.trim() : "";
  const authToken =
    typeof data.twilio_auth_token === "string" ? data.twilio_auth_token.trim() : "";
  const phoneNumber =
    typeof data.twilio_phone_number === "string"
      ? data.twilio_phone_number.trim()
      : "";
  const forwardingNumber =
    typeof data.forwarding_number === "string" ? data.forwarding_number.trim() : "";

  if (!accountSid || !authToken || !phoneNumber || !forwardingNumber) {
    return null;
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    forwardingNumber,
  };
}

export async function getTwilioProfilePublic(
  userId: string,
): Promise<TwilioProfilePublic> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select(
      "twilio_account_sid, twilio_auth_token, twilio_phone_number, forwarding_number",
    )
    .eq("id", userId)
    .maybeSingle();

  const accountSid =
    typeof data?.twilio_account_sid === "string" ? data.twilio_account_sid : "";
  const phoneNumber =
    typeof data?.twilio_phone_number === "string" ? data.twilio_phone_number : "";
  const forwardingNumber =
    typeof data?.forwarding_number === "string" ? data.forwarding_number : "";
  const hasAuthToken =
    typeof data?.twilio_auth_token === "string" && data.twilio_auth_token.trim().length > 0;

  const isActive =
    accountSid.trim().length > 0 &&
    phoneNumber.trim().length > 0 &&
    forwardingNumber.trim().length > 0 &&
    hasAuthToken;

  return {
    twilio_account_sid: accountSid,
    twilio_phone_number: phoneNumber,
    forwarding_number: forwardingNumber,
    has_twilio_auth_token: hasAuthToken,
    is_active: isActive,
  };
}

export async function getAuthenticatedUserProfile(): Promise<{
  userId: string;
  profile: UserProfile | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await getUserProfile(user.id);
  return { userId: user.id, profile };
}

export async function requireProUser(): Promise<
  { ok: true; userId: string; profile: UserProfile } | { ok: false; error: string }
> {
  const auth = await getAuthenticatedUserProfile();
  if (!auth) {
    return { ok: false, error: "Sign in required" };
  }
  if (!isPro(auth.profile)) {
    return { ok: false, error: "Pro subscription required" };
  }
  return {
    ok: true,
    userId: auth.userId,
    profile: auth.profile!,
  };
}
