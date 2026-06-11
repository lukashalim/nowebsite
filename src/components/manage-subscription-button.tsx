interface ManageSubscriptionButtonProps {
  className?: string;
  label?: string;
}

const defaultClassName =
  "inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function ManageSubscriptionButton({
  className = defaultClassName,
  label = "Manage subscription",
}: ManageSubscriptionButtonProps) {
  return (
    <a href="/api/stripe/portal" className={className}>
      {label}
    </a>
  );
}
