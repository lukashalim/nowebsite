import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { stripContactFieldsList } from "@/lib/directory/contact-fields";
import type { DirectoryBusiness } from "@/lib/directory/types";
import { DirectoryBusinessListBody } from "@/components/directory-business-list-body";

interface DirectoryBusinessListProps {
  businesses: DirectoryBusiness[];
  /** On nationwide category pages, show city/state instead of neighborhood-only area. */
  showCityState?: boolean;
  contactAccess: DirectoryContactAccess;
}

export function DirectoryBusinessList({
  businesses,
  showCityState = false,
  contactAccess,
}: DirectoryBusinessListProps) {
  const publicRows = stripContactFieldsList(businesses);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Area</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Reviews</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Checked</th>
            <th className="px-4 py-3">Maps</th>
          </tr>
        </thead>
        <DirectoryBusinessListBody
          businesses={publicRows}
          showCityState={showCityState}
          contactAccess={contactAccess}
        />
      </table>
    </div>
  );
}
