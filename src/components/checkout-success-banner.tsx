"use client";

interface CheckoutSuccessBannerProps {
  show: boolean;
  isPro: boolean;
}

export function CheckoutSuccessBanner({ show, isPro }: CheckoutSuccessBannerProps) {
  if (!show) return null;

  if (isPro) {
    return (
      <div
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        role="status"
      >
        <p className="font-medium">Welcome to Pro!</p>
        <p className="mt-1 opacity-90">
          Your subscription is active. All CRM features are now unlocked.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
      role="status"
    >
      <p className="font-medium">Payment received</p>
      <p className="mt-1 opacity-90">
        Pro access activates in a moment — refresh this page if features are
        still locked.
      </p>
    </div>
  );
}
