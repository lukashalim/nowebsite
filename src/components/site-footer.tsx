import Link from "next/link";
import { fetchDirectoryLastUpdatedLabel } from "@/lib/directory/data";

const footerLinkClass =
  "text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

const DIRECTORY_LINKS = [
  { href: "/cities", label: "Cities" },
  { href: "/states", label: "States" },
  { href: "/categories", label: "Categories" },
  { href: "/united-kingdom", label: "United Kingdom" },
  { href: "/facebook", label: "Facebook-as-Website Leads" },
] as const;

export async function SiteFooter() {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit footer freshness when directory data is unavailable
  }

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <nav
          aria-label="Directory browse links"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
        >
          {DIRECTORY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={footerLinkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
        {lastUpdatedLabel ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Prospect data last updated: {lastUpdatedLabel}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
