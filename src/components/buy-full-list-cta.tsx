import { BUY_FULL_LIST_STRIPE_URL } from "@/lib/directory/buy-full-list";

interface BuyFullListCtaProps {
  variant: "secondary" | "export";
}

export function BuyFullListCta({ variant }: BuyFullListCtaProps) {
  const label =
    variant === "secondary"
      ? "Just want this list? Get the full export — $9"
      : "Want this as a spreadsheet? Get the full CSV — $9";

  if (variant === "secondary") {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <a
          href={BUY_FULL_LIST_STRIPE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          {label}
        </a>
      </p>
    );
  }

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Want this as a spreadsheet? Get the full CSV —{" "}
      <a
        href={BUY_FULL_LIST_STRIPE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 dark:text-zinc-200"
      >
        $9
      </a>
    </p>
  );
}
