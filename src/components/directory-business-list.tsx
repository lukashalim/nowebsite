import { ExternalLink, MapPin, Phone, Star } from "lucide-react";
import type { DirectoryBusiness } from "@/lib/directory/types";
import { formatNeighborhoodOrArea } from "@/lib/directory/labels";

interface DirectoryBusinessListProps {
  businesses: DirectoryBusiness[];
}

export function DirectoryBusinessList({ businesses }: DirectoryBusinessListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Area</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Reviews</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Maps</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {businesses.map((b, i) => {
            const area = formatNeighborhoodOrArea(b.address, b.city);
            const phone = b.phone?.trim();
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
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-zinc-400" aria-hidden />
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
                <td className="px-4 py-3">
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {b.google_maps_link ? (
                    <a
                      href={b.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Maps
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
