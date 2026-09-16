import Link from "next/link";

const LINK_CLASS =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900";

interface AdminNavProps {
  current?: "purchases" | "usage" | "postcards" | "scrape" | "somers-report";
}

export function AdminNav({ current }: AdminNavProps) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {current !== "purchases" ? (
        <Link href="/admin/purchases" className={LINK_CLASS}>
          Purchases
        </Link>
      ) : null}
      {current !== "usage" ? (
        <Link href="/admin/usage" className={LINK_CLASS}>
          Usage
        </Link>
      ) : null}
      {current !== "postcards" ? (
        <Link href="/admin/postcards" className={LINK_CLASS}>
          Postcards
        </Link>
      ) : null}
      {current !== "scrape" ? (
        <Link href="/admin/scrape" className={LINK_CLASS}>
          Scrape
        </Link>
      ) : null}
      {current !== "somers-report" ? (
        <Link href="/report/somers-lawn-tree" className={LINK_CLASS}>
          Somers report
        </Link>
      ) : null}
      <Link href="/scrape-progress" className={LINK_CLASS}>
        Scrape progress
      </Link>
      <form action="/admin/logout" method="post">
        <button type="submit" className={LINK_CLASS}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
