import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { stripContactFieldsList } from "@/lib/directory/contact-fields";
import type { DirectoryBusiness } from "@/lib/directory/types";
import {
  DirectoryBusinessListBody,
} from "@/components/directory-business-list-body";

export type DirectoryBusinessListVariant = "default" | "category";

interface DirectoryBusinessListProps {
  businesses: DirectoryBusiness[];
  /** On nationwide category pages, show city/state instead of neighborhood-only area. */
  showCityState?: boolean;
  contactAccess: DirectoryContactAccess;
  variant?: DirectoryBusinessListVariant;
}

export function DirectoryBusinessList({
  businesses,
  showCityState = false,
  contactAccess,
  variant = "default",
}: DirectoryBusinessListProps) {
  const publicRows = stripContactFieldsList(businesses);
  const isCategory = variant === "category";
  const minWidth = isCategory ? "880px" : "800px";

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth: minWidth }}
      >
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-4 py-3">Business</th>
            {isCategory ? <th className="px-4 py-3">Category</th> : null}
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Reviews</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Checked</th>
            <th className="px-4 py-3">Maps</th>
          </tr>
        </thead>
        <DirectoryBusinessListBody
          businesses={publicRows}
          showCityState={showCityState}
          contactAccess={contactAccess}
          variant={variant}
        />
      </table>
    </div>
  );
}
