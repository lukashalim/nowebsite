import Link from "next/link";

const navLinkClass =
  "text-sm font-medium text-zinc-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent";

const browseLinkClass =
  "text-sm font-medium text-zinc-500 hover:text-accent dark:text-zinc-400 dark:hover:text-accent";

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
        <nav className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
          <Link href="/cities" className={browseLinkClass}>
            Cities
          </Link>
          <Link href="/states" className={browseLinkClass}>
            States
          </Link>
          <Link href="/categories" className={browseLinkClass}>
            Categories
          </Link>
          <Link href="/about" className={navLinkClass}>
            About
          </Link>
          <Link href="/united-kingdom" className={navLinkClass}>
            United Kingdom
          </Link>
          <Link href="/facebook" className={navLinkClass}>
            Facebook-as-Website Leads
          </Link>
          <Link href="/how-it-works" className={navLinkClass}>
            How It Works
          </Link>
          <Link href="/contact" className={navLinkClass}>
            Contact
          </Link>
          <Link
            href="/sign-in"
            className={`${navLinkClass} underline decoration-zinc-300 underline-offset-2 hover:decoration-accent dark:decoration-zinc-600`}
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
