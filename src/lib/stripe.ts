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

/** Pro CRM subscription price ($27/month). */
export function getCrmProPriceId(): string {
  loadSharedEnvLocal();
  const priceId = process.env.STRIPE_CRM_PRO_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error("Missing STRIPE_CRM_PRO_PRICE_ID");
  }
  return priceId;
}

/** One-time $9 full directory CSV export. */
export function getCsvPriceId(): string {
  loadSharedEnvLocal();
  const priceId = process.env.STRIPE_CSV_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error("Missing STRIPE_CSV_PRICE_ID");
  }
  return priceId;
}
