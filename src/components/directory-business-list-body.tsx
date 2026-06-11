"use client";

import { MapPin, Star } from "lucide-react";
import type { DirectoryBusinessPublic } from "@/lib/directory/contact-fields";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import {
  formatListingCheckedAt,
  formatListingCheckedAtTitle,
  formatLocationLabel,
  formatNeighborhoodOrArea,
} from "@/lib/directory/labels";
import {
  DirectoryContactProvider,
  DirectoryMapsCell,
  DirectoryPhoneCell,
} from "@/components/directory-contact-cells";

interface DirectoryBusinessListBodyProps {
  businesses: DirectoryBusinessPublic[];
  showCityState?: boolean;
  contactAccess: DirectoryContactAccess;
}

export function DirectoryBusinessListBody({
  businesses,
  showCityState = false,
  contactAccess,
}: DirectoryBusinessListBodyProps) {
  return (
    <DirectoryContactProvider access={contactAccess} rowCount={businesses.length}>
      {({ contacts, loading }) => (
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {businesses.map((b, i) => {
            const area = showCityState
              ? formatLocationLabel(
                  b.city ?? "",
                  b.state ?? "",
                  b.country,
                ) || formatNeighborhoodOrArea(b.address, b.city)
              : formatNeighborhoodOrArea(b.address, b.city);
            const checkedLabel = formatListingCheckedAt(b.checkedAt);
            const checkedTitle = formatListingCheckedAtTitle(b.checkedAt);
            return (
              <tr
                key={`${b.name ?? "row"}-${i}`}
                className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {b.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {area ? (
                    <span className="inline-flex items-start gap-1">
                      <MapPin
                        className="mt-0.5 size-3.5 shrink-0 text-zinc-400"
                        aria-hidden
                      />
                      {area}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                  {b.rating != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Star
                        className="size-3.5 fill-amber-400 text-amber-400"
                        aria-hidden
                      />
                      {Number(b.rating).toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                  {b.reviews ?? "—"}
                </td>
                <DirectoryPhoneCell
                  rowIndex={i}
                  contacts={contacts}
                  loading={loading}
                />
                <td
                  className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400"
                  title={checkedTitle ?? undefined}
                >
                  {checkedLabel ?? "—"}
                </td>
                <DirectoryMapsCell
                  rowIndex={i}
                  contacts={contacts}
                  loading={loading}
                />
              </tr>
            );
          })}
        </tbody>
      )}
    </DirectoryContactProvider>
  );
}
