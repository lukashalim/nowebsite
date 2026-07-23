"use client";

import Link from "next/link";
import { ExternalLink, MapPin, Phone, Star } from "lucide-react";
import { useState } from "react";
import type { DirectoryBusinessPublic } from "@/lib/directory/contact-fields";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import type { DirectoryContactRow } from "@/lib/directory/contact-fields";
import { revealDirectoryContact } from "@/lib/directory/contact-api-client";
import {
  categoryPath,
  cityPath,
  formatCategoryDisplayName,
  formatListingCheckedAt,
  formatListingCheckedAtTitle,
  formatLocationLabel,
} from "@/lib/directory/labels";
import { categoryLabelToFlatSlug, cityStateToSlug } from "@/lib/directory/slugs";
import type { DirectoryBusinessListVariant } from "@/components/directory-business-list";
import { ProFeatureLock } from "@/components/pro-gate-overlay";

interface DirectoryBusinessListRowProps {
  business: DirectoryBusinessPublic;
  rowIndex: number;
  contactAccess: DirectoryContactAccess | null;
  showCityState?: boolean;
  variant?: DirectoryBusinessListVariant;
  publishedCitySlugs?: Set<string>;
  publishedCategorySlugs?: Set<string>;
}

function categoryLabelForRow(b: DirectoryBusinessPublic): string {
  const raw = b.main_category?.trim() || b.business_type?.trim();
  return raw ? formatCategoryDisplayName(raw) : "—";
}

function locationLabelForRow(
  b: DirectoryBusinessPublic,
  showCityState: boolean,
): string | null {
  if (showCityState) {
    return formatLocationLabel(b.city ?? "", b.state ?? "", b.country) || null;
  }
  const city = b.city?.trim();
  return city || null;
}

function cityHrefForRow(
  b: DirectoryBusinessPublic,
  publishedCitySlugs?: Set<string>,
): string | null {
  const city = b.city?.trim();
  const state = b.state?.trim();
  if (!city || !state) return null;
  const slug = cityStateToSlug(city, state, b.country);
  if (!slug || !publishedCitySlugs?.has(slug)) return null;
  return cityPath(slug);
}

function categoryHrefForRow(
  b: DirectoryBusinessPublic,
  publishedCategorySlugs?: Set<string>,
): string | null {
  const raw = b.main_category?.trim() || b.business_type?.trim();
  if (!raw) return null;
  const slug = categoryLabelToFlatSlug(raw);
  if (!slug || !publishedCategorySlugs?.has(slug)) return null;
  return categoryPath(slug);
}

export function DirectoryBusinessListRow({
  business: b,
  rowIndex,
  contactAccess,
  showCityState = false,
  variant = "default",
  publishedCitySlugs,
  publishedCategorySlugs,
}: DirectoryBusinessListRowProps) {
  const isCategory = variant === "category";
  const [contact, setContact] = useState<DirectoryContactRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const location = locationLabelForRow(b, showCityState);
  const locationHref = showCityState
    ? cityHrefForRow(b, publishedCitySlugs)
    : null;
  const categoryLabel = categoryLabelForRow(b);
  const categoryHref = isCategory
    ? categoryHrefForRow(b, publishedCategorySlugs)
    : null;
  const checkedLabel = formatListingCheckedAt(b.checkedAt);
  const checkedTitle = formatListingCheckedAtTitle(b.checkedAt);

  const contactsLocked = contactAccess == null;

  async function handleReveal() {
    if (!contactAccess || contact || loading) return;
    setLoading(true);
    setError(false);
    try {
      const row = await revealDirectoryContact(contactAccess, rowIndex);
      setContact(row);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const phone = contact?.phone;
  const address = contact?.address;
  const mapsLink = contact?.google_maps_link;

  return (
    <tr className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
        {b.name ?? "—"}
      </td>
      {isCategory ? (
        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
          {categoryHref ? (
            <Link
              href={categoryHref}
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {categoryLabel}
            </Link>
          ) : (
            categoryLabel
          )}
        </td>
      ) : null}
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
        {location ? (
          <span className="inline-flex items-start gap-1">
            <MapPin
              className="mt-0.5 size-3.5 shrink-0 text-zinc-400"
              aria-hidden
            />
            {locationHref ? (
              <Link href={locationHref} className="hover:underline">
                {location}
              </Link>
            ) : (
              location
            )}
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
        {contactsLocked ? (
          <a href="/api/stripe/checkout" className="inline-flex">
            <ProFeatureLock label="Pro" />
          </a>
        ) : phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            <Phone className="size-3.5" aria-hidden />
            {phone}
          </a>
        ) : loading ? (
          <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        ) : contact ? (
          "—"
        ) : (
          <button
            type="button"
            onClick={() => void handleReveal()}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {error ? "Retry" : "Reveal"}
          </button>
        )}
      </td>
      <td className="max-w-[200px] px-4 py-3 text-zinc-600 dark:text-zinc-300">
        {contactsLocked ? "—" : (address ?? "—")}
      </td>
      <td
        className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400"
        title={checkedTitle ?? undefined}
      >
        {checkedLabel ?? "—"}
      </td>
      <td className="px-4 py-3">
        {contactsLocked ? (
          "—"
        ) : loading ? (
          <span className="inline-block h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        ) : mapsLink ? (
          <a
            href={mapsLink}
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
}
