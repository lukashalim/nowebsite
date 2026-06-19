import Link from "next/link";

const hubLinkClass =
  "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-accent dark:text-zinc-100 dark:decoration-zinc-600";

export type DirectoryHubNavActive = "cities" | "states" | "categories";

interface DirectoryHubNavProps {
  active: DirectoryHubNavActive;
}

const HUBS: { id: DirectoryHubNavActive; label: string; href: string }[] = [
  { id: "cities", label: "city", href: "/cities" },
  { id: "states", label: "state", href: "/states" },
  { id: "categories", label: "category", href: "/categories" },
];

export function DirectoryHubNav({ active }: DirectoryHubNavProps) {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Browse by{" "}
      {HUBS.map((hub, index) => (
        <span key={hub.id}>
          {index > 0 ? " · " : null}
          {hub.id === active ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {hub.label}
            </span>
          ) : (
            <Link href={hub.href} className={hubLinkClass}>
              {hub.label}
            </Link>
          )}
        </span>
      ))}
    </p>
  );
}
