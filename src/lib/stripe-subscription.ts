import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
]);

function isStripeMissingResource(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const stripeError = error as Stripe.StripeRawError;
  return (
    stripeError.code === "resource_missing" ||
    stripeError.statusCode === 404
  );
}

async function clearStaleStripeCustomerId(userId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[stripe] failed to clear stale customer id", {
      userId,
      error: error.message,
    });
  }
}

function getSubscriptionId(
  session: Stripe.Checkout.Session,
): string | null {
  if (!session.subscription) return null;
  return typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;
}

function getCustomerId(session: Stripe.Checkout.Session): string | null {
  if (!session.customer) return null;
  return typeof session.customer === "string"
    ? session.customer
    : session.customer.id;
}

async function getSubscriptionPrice(
  subscriptionId: string,
): Promise<string | null> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const unitAmount = subscription.items.data[0]?.price?.unit_amount;
  return unitAmount != null ? String(unitAmount) : null;
}

export async function activateProProfile(
  userId: string,
  customerId: string | null,
  subscriptionPrice: string | null,
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("profiles")
    .select("subscription_started_at")
    .eq("id", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    is_pro: true,
    stripe_customer_id: customerId,
    subscription_price: subscriptionPrice,
    updated_at: now,
  };

  if (!existing?.subscription_started_at) {
    update.subscription_started_at = now;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);

  if (error) {
    console.error("[stripe] failed to activate pro", {
      userId,
      error: error.message,
    });
    return false;
  }

  return true;
}

export async function deactivateProByCustomerId(
  customerId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_pro: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[stripe] failed to deactivate pro", {
      customerId,
      error: error.message,
    });
    return false;
  }

  return true;
}

export async function resolveUserIdFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const fromMeta = session.metadata?.supabase_user_id?.trim();
  if (fromMeta) return fromMeta;

  const fromRef = session.client_reference_id?.trim();
  if (fromRef) return fromRef;

  const email =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    null;

  if (!email) return null;

  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

export async function activateProFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.mode !== "subscription" || session.payment_status !== "paid") {
    return false;
  }

  const userId = await resolveUserIdFromCheckoutSession(session);
  if (!userId) {
    console.error("[stripe] checkout.session.completed: no user match", {
      sessionId: session.id,
    });
    return false;
  }

  const subscriptionId = getSubscriptionId(session);
  let subscriptionPrice: string | null = null;

  if (subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return false;
    }
    subscriptionPrice = await getSubscriptionPrice(subscriptionId);
  }

  return activateProProfile(userId, getCustomerId(session), subscriptionPrice);
}

export async function syncProForUser(
  userId: string,
  options?: {
    checkoutSessionId?: string;
    stripeCustomerId?: string | null;
    searchRecentCheckout?: boolean;
  },
): Promise<boolean> {
  const stripe = getStripe();

  if (options?.checkoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        options.checkoutSessionId,
        { expand: ["subscription"] },
      );

      const sessionUserId = await resolveUserIdFromCheckoutSession(session);
      if (sessionUserId !== userId) {
        return false;
      }

      return activateProFromCheckoutSession(session);
    } catch (error) {
      if (isStripeMissingResource(error)) {
        console.warn("[stripe] checkout session not found during pro sync", {
          userId,
          checkoutSessionId: options.checkoutSessionId,
        });
        return false;
      }
      throw error;
    }
  }

  const customerId = options?.stripeCustomerId?.trim();
  if (customerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });

      const active = subscriptions.data.find((subscription) =>
        ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
      );

      if (active) {
        const subscriptionPrice = active.items.data[0]?.price?.unit_amount;
        return activateProProfile(
          userId,
          customerId,
          subscriptionPrice != null ? String(subscriptionPrice) : null,
        );
      }
    } catch (error) {
      if (isStripeMissingResource(error)) {
        console.warn("[stripe] stale customer id during pro sync, clearing", {
          userId,
          customerId,
        });
        await clearStaleStripeCustomerId(userId);
        return false;
      }
      throw error;
    }
  }

  if (!options?.searchRecentCheckout) {
    return false;
  }

  const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400;
  const listed = await stripe.checkout.sessions.list({
    status: "complete",
    limit: 100,
    created: { gte: oneDayAgo },
  });

  for (const session of listed.data) {
    if (session.client_reference_id !== userId) continue;
    if (session.payment_status !== "paid") continue;
    const activated = await activateProFromCheckoutSession(session);
    if (activated) return true;
  }

  return false;
}
