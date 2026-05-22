import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PublicNav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          No Website Business Leads
        </Link>
        <Link
          href="/pro"
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          For Web Designers
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
