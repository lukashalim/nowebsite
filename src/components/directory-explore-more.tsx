import Link from "next/link";
import { directoryRowLinkClass } from "@/lib/directory/ui-classes";

export interface DirectoryExploreLink {
  href: string;
  label: string;
}

interface DirectoryExploreMoreProps {
  heading?: string;
  links: DirectoryExploreLink[];
}

export function DirectoryExploreMore({
  heading = "Explore more",
  links,
}: DirectoryExploreMoreProps) {
  if (links.length === 0) return null;

  return (
    <section className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {heading}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={directoryRowLinkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
