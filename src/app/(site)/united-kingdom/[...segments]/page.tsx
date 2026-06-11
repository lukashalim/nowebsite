import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { DirectoryBusinessList } from "@/components/directory-business-list";
import { DownloadCsvButton } from "@/components/download-csv-button";
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
import { resolveGbPath } from "@/lib/directory/resolve-gb-path";
import { categoryPath } from "@/lib/directory/labels";
import { absoluteUrl } from "@/lib/site-url";
import { gbCityPath, gbRegionPath } from "@/lib/directory/paths";
import {
  directoryBreadcrumbLinkClass,
  directoryRowLinkStaticClass,
  directoryRowLinkWithGapClass,
} from "@/lib/directory/ui-classes";
import { createDirectoryContactAccess } from "@/lib/directory/contact-access";
import { listingScopeForGbCity } from "@/lib/directory/listing-scope";
import { stripContactFieldsList } from "@/lib/directory/contact-fields";

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
    return absoluteUrl(gbCityPath(segments[0]!));
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
        getCityHref={(group) => gbCityPath(group.citySlug)}
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
    const citySlug = segments[0]!;
    const regionSlug = hub.regionSlug;
    const contactAccess = createDirectoryContactAccess(
      listingScopeForGbCity(citySlug),
      1,
      { stateSlug: null, citySlug: null, minReviews: 0 },
    );
    const title = cityHubTitle(hub.city, hub.state, COUNTRY_GB, hub.region);
    const publishedSlugs = new Set(
      hub.publishedCategories.map((c) => c.categorySlug),
    );

    return (
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm text-zinc-500">
            <Link href="/" className={directoryBreadcrumbLinkClass}>
              Home
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbCountryPath()} className={directoryBreadcrumbLinkClass}>
              United Kingdom
            </Link>
            <span aria-hidden> / </span>
            <Link href={gbRegionPath(regionSlug)} className={directoryBreadcrumbLinkClass}>
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
                const hasNationwidePage = publishedSlugs.has(cat.categorySlug);
                const inner = (
                  <>
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
                        {!hasNationwidePage ? (
                          <span className="ml-1 text-xs font-normal text-zinc-400">
                            (local)
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={cat.categorySlug}>
                    {hasNationwidePage ? (
                      <Link
                        href={categoryPath(cat.categorySlug)}
                        className={directoryRowLinkWithGapClass}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className={directoryRowLinkStaticClass}>{inner}</div>
                    )}
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
          <DirectoryBusinessList
            businesses={businesses}
            contactAccess={contactAccess}
          />
        </section>

        {businesses.length > 0 ? (
          <DownloadCsvButton
            businesses={stripContactFieldsList(businesses)}
            contactAccess={contactAccess}
            pagePath={gbCityPath(citySlug)}
          />
        ) : null}
      </div>
    );
  }

  notFound();
}
