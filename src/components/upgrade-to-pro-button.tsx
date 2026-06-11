interface UpgradeToProButtonProps {
  className?: string;
  label?: string;
}

const defaultClassName =
  "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600";

export function UpgradeToProButton({
  className = defaultClassName,
  label = "Upgrade to Pro — $27/month",
}: UpgradeToProButtonProps) {
  return (
    <a href="/api/stripe/checkout" className={className}>
      {label}
    </a>
  );
}
