/**
 * One-off: re-run list-purchase fulfillment + Resend email for a Checkout Session.
 *
 * Usage:
 *   npx tsx scripts/refulfill-list-purchase.ts cs_live_...
 */
import { getStripe } from "../src/lib/stripe";
import { fulfillListPurchaseFromSession } from "../src/lib/directory/list-purchase";

async function main() {
  const sessionId = process.argv[2]?.trim();
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/refulfill-list-purchase.ts <checkout_session_id>");
    process.exit(1);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    console.error("Session is not paid:", session.payment_status);
    process.exit(1);
  }

  // Allow re-run after a prior failure by clearing fulfilled early-return:
  // fulfillListPurchaseFromSession already retries non-fulfilled rows.
  const result = await fulfillListPurchaseFromSession(session);
  console.log("Fulfillment result:", {
    sessionId: result.stripe_session_id,
    status: result.status,
    storage_path: result.storage_path,
    scope: `${result.scope_kind}:${result.scope_slug}`,
    total_rows: result.total_rows,
    free_rows_given: result.free_rows_given,
    error_message: result.error_message,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
