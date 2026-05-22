import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ProCta() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Are you a web designer or agency?
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Get full access to leads plus outreach tools — contact stage tracking, review
        excerpts, DM spintax, and demo page builder.
      </p>
      <Link
        href="/pro"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Get full access to leads + outreach tools
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
