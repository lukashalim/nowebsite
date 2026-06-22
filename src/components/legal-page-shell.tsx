import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageShellProps {
  title: string;
  children: ReactNode;
}

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="mb-8 text-sm">
          <Link
            href="/"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Home
          </Link>
        </p>
        <article className="prose-legal space-y-8">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
              {title}
            </h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Last updated: June 12, 2026
            </p>
          </header>
          {children}
        </article>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}
