import Link from "next/link";
import {
  buildBreadcrumbListJsonLd,
  type BreadcrumbJsonLdItem,
} from "@/lib/directory/jsonld";
import { directoryBreadcrumbLinkClass } from "@/lib/directory/ui-classes";

export interface DirectoryBreadcrumbItem {
  label: string;
  href?: string;
}

interface DirectoryBreadcrumbsProps {
  items: DirectoryBreadcrumbItem[];
  /** Page path for BreadcrumbList @id (e.g. `/texas`). */
  pagePath: string;
}

export function DirectoryBreadcrumbs({ items, pagePath }: DirectoryBreadcrumbsProps) {
  if (items.length === 0) return null;

  const jsonLdItems: BreadcrumbJsonLdItem[] = items.map((item) => ({
    name: item.label,
    path: item.href,
  }));
  const jsonLd = buildBreadcrumbListJsonLd(pagePath, jsonLdItems);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm text-zinc-500">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="inline-flex items-center">
                {index > 0 ? (
                  <span aria-hidden className="mx-1">
                    /
                  </span>
                ) : null}
                {item.href && !isLast ? (
                  <Link href={item.href} className={directoryBreadcrumbLinkClass}>
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "text-zinc-700 dark:text-zinc-300" : undefined}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
