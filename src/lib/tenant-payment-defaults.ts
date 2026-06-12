export const DEFAULT_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_LINK?.trim() || "/pro";

export function resolveTenantPaymentLink(
  userPaymentLink: string | null | undefined,
): string {
  const trimmed = userPaymentLink?.trim();
  return trimmed || DEFAULT_PAYMENT_LINK;
}
