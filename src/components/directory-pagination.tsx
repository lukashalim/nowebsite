import Link from "next/link";
import {
  categoryPathWithPage,
  directoryPaginationItems,
} from "@/lib/directory/pagination";

interface DirectoryPaginationProps {
  categorySlug: string;
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
}

export function DirectoryPagination({
  categorySlug,
  page,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
}: DirectoryPaginationProps) {
  if (totalPages <= 1) return null;

  const items = directoryPaginationItems(page, totalPages);

  return (
    <nav
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Category listings pagination"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing{" "}
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
          {totalCount.toLocaleString()}
        </span>{" "}
        listings
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={categoryPathWithPage(categorySlug, page - 1)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              rel="prev"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-400">
              Previous
            </span>
          )}
        </li>
        {items.map((item, i) =>
          item === "ellipsis" ? (
            <li
              key={`ellipsis-${i}`}
              className="px-2 text-sm text-zinc-400"
              aria-hidden
            >
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span
                  className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  aria-current="page"
                >
                  {item}
                </span>
              ) : (
                <Link
                  href={categoryPathWithPage(categorySlug, item)}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm tabular-nums hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link
              href={categoryPathWithPage(categorySlug, page + 1)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              rel="next"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-400">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
