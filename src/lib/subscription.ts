import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
}

export function isPro(profile: UserProfile | null | undefined): boolean {
  return profile?.is_pro === true;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, username, user_payment_link, is_pro, stripe_customer_id, subscription_price, subscription_started_at, sendfox_subscribed_at, sendfox_confirmed_at",
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
