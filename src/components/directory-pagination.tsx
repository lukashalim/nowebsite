import Link from "next/link";
import { directoryPaginationActiveClass, directoryPaginationLinkClass } from "@/lib/directory/ui-classes";
import { directoryPaginationItems } from "@/lib/directory/pagination";

interface DirectoryPaginationProps {
  hrefForPage: (page: number) => string;
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  ariaLabel?: string;
}

export function DirectoryPagination({
  hrefForPage,
  page,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  ariaLabel = "Listings pagination",
}: DirectoryPaginationProps) {
  if (totalPages <= 1) return null;

  const items = directoryPaginationItems(page, totalPages);

  return (
    <nav
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={ariaLabel}
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
              href={hrefForPage(page - 1)}
              className={directoryPaginationLinkClass}
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
                <span className={directoryPaginationActiveClass} aria-current="page">
                  {item}
                </span>
              ) : (
                <Link href={hrefForPage(item)} className={`${directoryPaginationLinkClass} tabular-nums`}>
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link
              href={hrefForPage(page + 1)}
              className={directoryPaginationLinkClass}
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
