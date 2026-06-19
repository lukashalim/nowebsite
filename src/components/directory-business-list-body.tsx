import type { DirectoryBusinessPublic } from "@/lib/directory/contact-fields";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { DirectoryBusinessListRow } from "@/components/directory-business-list-row";
import type { DirectoryBusinessListVariant } from "@/components/directory-business-list";

interface DirectoryBusinessListBodyProps {
  businesses: DirectoryBusinessPublic[];
  showCityState?: boolean;
  contactAccess: DirectoryContactAccess;
  variant?: DirectoryBusinessListVariant;
  publishedCitySlugs?: Set<string>;
  publishedCategorySlugs?: Set<string>;
}

export function DirectoryBusinessListBody({
  businesses,
  showCityState = false,
  contactAccess,
  variant = "default",
  publishedCitySlugs,
  publishedCategorySlugs,
}: DirectoryBusinessListBodyProps) {
  return (
    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {businesses.map((b, i) => (
        <DirectoryBusinessListRow
          key={`${b.name ?? "row"}-${i}`}
          business={b}
          rowIndex={i}
          contactAccess={contactAccess}
          showCityState={showCityState}
          variant={variant}
          publishedCitySlugs={publishedCitySlugs}
          publishedCategorySlugs={publishedCategorySlugs}
        />
      ))}
    </tbody>
  );
}
