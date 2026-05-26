import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DirectoryLastUpdated } from "@/components/directory-last-updated";
import { DirectoryStatePage } from "@/components/directory-state-page";
import {
  categoryLinkLabel,
  cityHubMetaDescription,
  cityHubTitle,
  formatLocationLabel,
  gbCountryPath,
  ukRegionHubMetaDescription,
  ukRegionHubMetaTitle,
} from "@/lib/directory/labels";
import { COUNTRY_GB } from "@/lib/directory/country";
import { gbCityCategoryHref } from "@/lib/directory/gb-data";
import { resolveGbPath } from "@/lib/directory/resolve-gb-path";
import { categoryPath } from "@/lib/directory/labels";
import { absoluteUrl } from "@/lib/site-url";
import { gbCityPath, gbRegionPath } from "@/lib/directory/paths";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ segments: string[] }>;
}

function canonicalFor(
  segments: string[],
  resolved: Awaited<ReturnType<typeof resolveGbPath>>,
): string {
  const base = gbCountryPath();
  if (resolved.kind === "region") {
    return absoluteUrl(gbRegionPath(segments[0]!));
  }
  if (resolved.kind === "city") {
    return absoluteUrl(gbCityPath(segments[0]!, segments[1]!));
  }
  if (resolved.kind === "cityCategory") {
    return absoluteUrl(
      `${gbCityPath(segments[0]!, segments[1]!)}/${segments[2]!}`,
    );
  }
  return absoluteUrl(base);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const resolved = await resolveGbPath(segments);

  if (resolved.kind === "redirect") {
    return { title: "Redirecting…" };
  }
  if (resolved.kind === "notFound") {
    return { title: "Not found" };
  }

  if (resolved.kind === "region") {
    const { data } = resolved;
    return {
      title: { absolute: ukRegionHubMetaTitle(data.region) },
      description: ukRegionHubMetaDescription(
        data.region,
        data.listingCount,
        data.cityCount,
        data.lastUpdatedLabel,
      ),
      alternates: { canonical: canonicalFor(segments, resolved) },
    };
  }

  if (resolved.kind === "city") {
    const { hub } = resolved;
    const title = cityHubTitle(hub.city, hub.state, COUNTRY_GB, hub.region);
    const description = cityHubMetaDescription(
      hub.city,
      hub.state,
      hub.listingCount,
      hub.lastUpdatedLabel,
      COUNTRY_GB,
      hub.region,
    );
    return {
      title: { absolute: `${title} | No Website Business Leads` },
      description,
      alternates: { canonical: canonicalFor(segments, resolved) },
    };
  }

  if (resolved.kind === "cityCategory") {
    const { hub, categoryLabel, listingCount } = resolved;
    const place = formatLocationLabel(
      hub.city,
      hub.state,
      COUNTRY_GB,
      hub.region,
    );
    return {
      title: {
        absolute: `${categoryLinkLabel(categoryLabel)} in ${place} | No Website Business Leads`,
      },
      description: `Browse ${listingCount.toLocaleString()} ${categoryLinkLabel(categoryLabel).toLowerCase()} in ${place} without a website.`,
      alternates: { canonical: canonicalFor(segments, resolved) },
    };
  }

  return { title: "Not found" };
}

export default async function UnitedKingdomNestedPage({ params }: PageProps) {
  const { segments } = await params;
  const resolved = await resolveGbPath(segments);

  if (resolved.kind === "redirect") {
    permanentRedirect(resolved.to);
  }
  if (resolved.kind === "notFound") {
    notFound();
  }

  if (resolved.kind === "region") {
    const { data } = resolved;
    const regionSlug = segments[0]!.toLowerCase();
    return (
      <DirectoryStatePage
        stateSlug={regionSlug}
        state={data.region}
        businesses={data.businesses}
        cityGroups={data.cityGroups}
        cityCount={data.cityCount}
        lastUpdatedLabel={data.lastUpdatedLabel}
        publishedCitySlugs={data.publishedCitySlugs}
        hubHref={gbCountryPath()}
        hubLabel="United Kingdom"
        isUkRegion
        pathPrefix={gbCountryPath()}
        getCityHref={(group) =>
          group.regionSlug
            ? gbCityPath(group.regionSlug, group.citySlug)
            : gbCityPath(regionSlug, group.citySlug)
        }
        isCityPublished={(group) =>
          data.publishedCitySlugs.has(
            `${regionSlug}::${group.citySlug}`,
          )
        }
      />
    );
  }

  if (resolved.kind === "city") {
    const { hub, businesses } = resolved;
    const regionSlug = segments[0]!;
    const citySlug = segments[1]!;
    const title = cityHubTitle(hub.city, hub.state, COUNTRY_GB, hub.region);
    const publishedSlugs = new Set(
      hub.publishedCategories.map((c) => c.categorySlug),
    );

    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbCountryPath()} className="hover:underline">
              United Kingdom
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbRegionPath(regionSlug)} className="hover:underline">
              {hub.region}
            </Link>
            <span aria-hidden> / </span>
            {hub.city}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {hub.listingCount.toLocaleString()} local businesses in{" "}
            {formatLocationLabel(hub.city, hub.state, COUNTRY_GB, hub.region)}{" "}
            without a standalone website — phone numbers, ratings, and Google Maps
            links for outreach.
          </p>
        </header>

        <DirectoryLastUpdated label={hub.lastUpdatedLabel} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Categories
          </h2>
          {hub.categories.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No category breakdown yet. See all listings below.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {hub.categories.map((cat) => {
                const hasPage = publishedSlugs.has(cat.categorySlug);
                const href = gbCityCategoryHref(
                  regionSlug,
                  citySlug,
                  cat.categorySlug,
                );
                return (
                  <li key={cat.categorySlug}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <CategoryIcon
                        categoryLabel={cat.categoryLabel}
                        className="size-4 shrink-0 text-zinc-500"
                      />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {categoryLinkLabel(cat.categoryLabel)}
                        </span>
                        <span className="tabular-nums text-zinc-500">
                          {cat.listingCount}
                          {!hasPage ? (
                            <span className="ml-1 text-xs font-normal text-zinc-400">
                              (local)
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            All listings in {hub.city}
          </h2>
          <DirectoryBusinessList businesses={businesses} />
        </section>
      </div>
    );
  }

  if (resolved.kind === "cityCategory") {
    const { hub, businesses, categoryLabel, listingCount, lastUpdatedLabel } =
      resolved;
    const regionSlug = segments[0]!;
    const citySlug = segments[1]!;
    const categorySlug = segments[2]!;
    const place = formatLocationLabel(
      hub.city,
      hub.state,
      COUNTRY_GB,
      hub.region,
    );

    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbCountryPath()} className="hover:underline">
              United Kingdom
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbRegionPath(regionSlug)} className="hover:underline">
              {hub.region}
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbCityPath(regionSlug, citySlug)} className="hover:underline">
              {hub.city}
            </Link>
            <span aria-hidden> / </span>
            {categoryLinkLabel(categoryLabel)}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {categoryLinkLabel(categoryLabel)} in {place}
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            {listingCount.toLocaleString()} listings in {place} without their own
            website.
            {hub.publishedCategories.some(
              (c) => c.categorySlug === categorySlug,
            ) ? (
              <>
                {" "}
                <Link
                  href={categoryPath(categorySlug)}
                  className="underline hover:no-underline"
                >
                  Nationwide {categoryLinkLabel(categoryLabel).toLowerCase()}{" "}
                  directory
                </Link>
                .
              </>
            ) : null}
          </p>
        </header>

        <DirectoryLastUpdated label={lastUpdatedLabel} />
        <DirectoryBusinessList businesses={businesses} />
      </div>
    );
  }

  notFound();
}
