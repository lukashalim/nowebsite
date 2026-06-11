import Stripe from "stripe";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  loadSharedEnvLocal();
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getStripePriceId(): string {
  loadSharedEnvLocal();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_ID");
  }
  return priceId;
}
