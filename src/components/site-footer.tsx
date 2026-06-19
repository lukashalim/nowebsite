import { fetchDirectoryLastUpdatedLabel } from "@/lib/directory/data";

export async function SiteFooter() {
  let lastUpdatedLabel: string | null = null;
  try {
    lastUpdatedLabel = await fetchDirectoryLastUpdatedLabel();
  } catch {
    // omit footer freshness when directory data is unavailable
  }

  if (!lastUpdatedLabel) return null;

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Prospect data last updated: {lastUpdatedLabel}
        </p>
      </div>
    </footer>
  );
}
