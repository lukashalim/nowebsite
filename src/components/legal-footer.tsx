import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-sm text-zinc-500 sm:px-6 dark:text-zinc-400">
        <Link
          href="/privacy"
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Privacy Policy
        </Link>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
          |
        </span>
        <Link
          href="/terms"
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Terms of Service
        </Link>
      </div>
    </footer>
  );
}
