import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Share2,
  Star,
  Clock3,
} from "lucide-react";
import { fetchDemoBusinessByPlaceId } from "@/lib/crm-cohort";
import { DemoReviewCarousel } from "@/components/demo-review-carousel";
import { buildLocalBusinessJsonLd } from "@/lib/demo-local-business-jsonld";
import {
  enrichmentSocialLinksForUi,
  extractDemoPublicEmail,
  isDemoEmailVisible,
  openStreetMapLink,
  truncateForMeta,
} from "@/lib/demo-enrichment";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ placeId: string }>;
}

function serviceLabel(b: {
  business_type: string | null;
  main_category: string | null;
}): string {
  const businessType = b.business_type?.trim() ?? "";
  const isPlaceholder =
    businessType.toLowerCase() === "local_cache" ||
    businessType.toLowerCase() === "local cache";
  if (businessType && !isPlaceholder) {
    return businessType;
  }
  return b.main_category?.trim() || "Local services";
}

function formatTitle(b: Awaited<ReturnType<typeof fetchDemoBusinessByPlaceId>>) {
  if (!b) return "Demo not found";
  const name = b.name?.trim() || "Local business";
  const service = serviceLabel(b);
  const city = b.city?.trim();
  const state = b.state?.trim();
  const loc = [city, state].filter(Boolean).join(", ");
  return loc ? `${name} | ${service} in ${loc}` : `${name} | ${service}`;
}

function formatDescription(b: NonNullable<
  Awaited<ReturnType<typeof fetchDemoBusinessByPlaceId>>
>): string {
  const summary = b.enrichment?.sales_summary?.trim();
  if (summary) {
    return truncateForMeta(summary.replace(/\s+/g, " "));
  }
  const name = b.name?.trim() || "This business";
  const service = serviceLabel(b);
  const parts = [
    `${name} — ${service}.`,
    b.address ? ` ${b.address}.` : "",
    [b.city, b.state, b.postal_code].filter(Boolean).length
      ? ` Serving ${[b.city, b.state, b.postal_code].filter(Boolean).join(", ")}.`
      : "",
  ];
  if (b.rating != null && b.reviews != null) {
    parts.push(` Rated ${Number(b.rating).toFixed(1)} from ${b.reviews} reviews.`);
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { placeId } = await params;
  const b = await fetchDemoBusinessByPlaceId(placeId);
  if (!b) {
    return { title: "Demo not found" };
  }
  const path = `/demo/${encodeURIComponent(b.place_id)}`;
  return {
    title: formatTitle(b),
    description: formatDescription(b),
    alternates: { canonical: path },
    openGraph: {
      title: formatTitle(b),
      description: formatDescription(b),
      url: absoluteUrl(path),
      type: "website",
    },
  };
}

const SUMMARY_PREVIEW_LEN = 320;
const MIN_REVIEW_EXCERPTS = 3;

function SocialIcon() {
  return <Share2 className="size-4" aria-hidden />;
}

function formatHoursLine(hour: {
  day: string;
  opens?: string;
  closes?: string;
  text?: string;
}) {
  if (hour.text) return `${hour.day}: ${hour.text}`;
  if (hour.opens && hour.closes) return `${hour.day}: ${hour.opens} - ${hour.closes}`;
  return hour.day;
}

function toTitleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && word.toUpperCase() === word) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function formatBusinessDisplayName(name: string | null, service: string): string {
  const base = (name ?? "").replace(/\s+/g, " ").trim();
  if (!base) return "Local Business";
  const baseLower = base.toLowerCase();
  const serviceLower = service.trim().toLowerCase();
  if (serviceLower && baseLower.endsWith(serviceLower)) {
    const trimmed = base.slice(0, base.length - service.length).trim();
    if (trimmed) return toTitleCaseWords(trimmed);
  }
  return toTitleCaseWords(base);
}

export default async function DemoBusinessPage({ params }: PageProps) {
  const { placeId } = await params;
  const b = await fetchDemoBusinessByPlaceId(placeId);
  if (!b) {
    notFound();
  }

  const service = serviceLabel(b);
  const displayName = formatBusinessDisplayName(b.name, service);
  const locLine =
    [b.city, b.state, b.postal_code].filter(Boolean).join(", ") ||
    b.address ||
    "";
  const jsonLd = buildLocalBusinessJsonLd(b);
  const salesSummary = b.enrichment?.sales_summary?.trim() ?? null;
  const summaryShort =
    salesSummary && salesSummary.length > SUMMARY_PREVIEW_LEN
      ? `${salesSummary.slice(0, SUMMARY_PREVIEW_LEN).trim()}…`
      : salesSummary;
  const showAds = b.is_spending_on_ads === true;
  const osm = openStreetMapLink(
    b.latitude ?? null,
    b.longitude ?? null,
  );
  const extraSocial = enrichmentSocialLinksForUi({
    facebook_url: b.facebook_url,
    google_maps_link: b.google_maps_link,
    enrichment: b.enrichment ?? null,
  });
  const demoEmail =
    isDemoEmailVisible() ? extractDemoPublicEmail(b.enrichment ?? null) : null;
  const weakness = b.competitive_weakness?.trim();
  const callHref = b.phone?.trim() ? `tel:${b.phone.replace(/\s/g, "")}` : null;
  const reviews = (b.review_highlights ?? []).slice(0, 10);
  const hasReviewCarousel = reviews.length >= MIN_REVIEW_EXCERPTS;
  const services = b.services_offered ?? [];
  const hours = b.hours ?? [];
  const areaServedBits = [b.city, b.state, b.postal_code].filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article
        className="mx-auto min-h-screen max-w-3xl flex-1 bg-white px-5 py-12 text-zinc-900 sm:px-8 sm:py-14"
        style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      >
        <p className="mb-4 text-sm">
          <Link
            href="/demo"
            className="font-medium text-blue-600 hover:underline"
          >
            ← All demo sites
          </Link>
        </p>

        <header className="mb-16 space-y-4 border-b border-zinc-200 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            {service}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            {displayName}
          </h1>
          {showAds ? (
            <p className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
              <Megaphone className="size-3.5 shrink-0" aria-hidden />
              Likely investing in local search ads (demo signal from listings
              data)
            </p>
          ) : null}
          {locLine ? (
            <p className="flex items-start gap-2 text-zinc-700">
              <MapPin className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
              <span>
                {b.address ? (
                  <>
                    {b.address}
                    <br />
                  </>
                ) : null}
                {locLine}
              </span>
            </p>
          ) : null}
          {(b.rating != null || callHref) ? (
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-start">
              {b.rating != null ? (
                <p className="inline-flex items-center gap-2 py-3 text-zinc-900">
              <Star className="size-5 fill-amber-500 text-amber-500" aria-hidden />
                  <span className="tabular-nums">
                    {Number(b.rating).toFixed(1)} stars
                    {b.reviews != null ? ` · ${b.reviews} reviews` : ""}
                  </span>
                </p>
              ) : null}
              {callHref ? (
                <a
                  href={callHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md sm:w-auto"
                >
                  <Phone className="size-5" aria-hidden />
                  Call us at {b.phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </header>

        {hasReviewCarousel ? <DemoReviewCarousel reviews={reviews} /> : null}

        {salesSummary ? (
          <section
            className="mb-10 space-y-2"
            aria-labelledby="about-summary-heading"
          >
            <h2
              id="about-summary-heading"
              className="text-lg font-semibold text-zinc-900"
            >
              About this business
            </h2>
            <div className="leading-relaxed text-zinc-700">
              {salesSummary.length > SUMMARY_PREVIEW_LEN ? (
                <>
                  <p className="whitespace-pre-wrap">{summaryShort}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">
                      Read full summary
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap">{salesSummary}</p>
                  </details>
                </>
              ) : (
                <p className="whitespace-pre-wrap">{salesSummary}</p>
              )}
            </div>
          </section>
        ) : null}

        <section className="mb-14 space-y-4" aria-labelledby="services-heading">
          <h2
            id="services-heading"
            className="text-lg font-semibold text-zinc-900"
          >
            Services
          </h2>
          {services.length > 0 ? (
            <ul className="grid gap-3 text-zinc-700 sm:grid-cols-2">
              {services.slice(0, 8).map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium shadow-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="leading-relaxed text-zinc-700">
              {b.name ?? "We"} provide {service.toLowerCase()} for homes and
              businesses
              {locLine ? ` in and around ${locLine}` : " in your area"}. Contact
              us for a quote or to schedule service.
            </p>
          )}
        </section>

        {hours.length > 0 || b.open_now != null ? (
          <section className="mb-14 space-y-4" aria-labelledby="hours-heading">
            <h2
              id="hours-heading"
              className="text-lg font-semibold text-zinc-900"
            >
              Business hours
            </h2>
            {b.open_now != null ? (
              <p className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ${b.open_now ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>
                <Clock3 className="size-3.5" aria-hidden />
                {b.open_now ? "Open now" : "Currently closed"}
              </p>
            ) : null}
            {hours.length > 0 ? (
              <ul className="space-y-1 text-zinc-700">
                {hours.map((hour) => (
                  <li key={`${hour.day}-${hour.opens ?? hour.text ?? ""}`}>
                    {formatHoursLine(hour)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="mb-14 space-y-4" aria-labelledby="area-heading">
          <h2
            id="area-heading"
            className="text-lg font-semibold text-zinc-900"
          >
            Service area
          </h2>
          <p className="leading-relaxed text-zinc-700">
            {areaServedBits.length
              ? `Based on the Google Business Profile location, this business serves ${areaServedBits.join(", ")} and nearby communities.`
              : "Serving the local area shown on the business profile."}
          </p>
        </section>

        {weakness ? (
          <section
            className="mb-10 rounded-xl border border-amber-200/80 bg-amber-50/80 p-5"
            aria-labelledby="opportunity-heading"
          >
            <h2
              id="opportunity-heading"
              className="mb-2 text-lg font-semibold text-zinc-900"
            >
              Stand out online
            </h2>
            <p className="mb-2 text-xs text-zinc-600">
              Demo-only synthesis from public review themes — not a statement of
              fact.
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
              {weakness}
            </p>
          </section>
        ) : null}

        {extraSocial.length > 0 ? (
          <section
            className="mb-10 space-y-3"
            aria-labelledby="social-heading"
          >
            <h2
              id="social-heading"
              className="text-lg font-semibold text-zinc-900"
            >
              Social
            </h2>
            <ul className="flex flex-wrap gap-3">
              {extraSocial.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-zinc-50"
                  >
                    <SocialIcon />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-6"
          aria-labelledby="contact-heading"
        >
          <h2
            id="contact-heading"
            className="mb-4 text-lg font-semibold text-zinc-900"
          >
            Contact
          </h2>
          <ul className="flex flex-col gap-3 text-zinc-800">
            {demoEmail ? (
              <li>
                <a
                  href={`mailto:${encodeURIComponent(demoEmail)}`}
                  className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                >
                  <Mail className="size-4" aria-hidden />
                  {demoEmail}
                </a>
              </li>
            ) : null}
            {b.phone?.trim() ? (
              <li>
                <a
                  href={`tel:${b.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                >
                  <Phone className="size-4" aria-hidden />
                  {b.phone}
                </a>
              </li>
            ) : null}
            {b.google_maps_link ? (
              <li>
                <a
                  href={b.google_maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Google Maps
                </a>
              </li>
            ) : null}
            {osm ? (
              <li>
                <a
                  href={osm}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                >
                  <MapPin className="size-4" aria-hidden />
                  View on map (OpenStreetMap)
                </a>
              </li>
            ) : null}
            {b.facebook_url ? (
              <li>
                <a
                  href={b.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
                >
                  <Share2 className="size-4" aria-hidden />
                  Facebook
                </a>
              </li>
            ) : null}
            {!demoEmail &&
            !b.phone?.trim() &&
            !b.google_maps_link &&
            !osm &&
            !b.facebook_url ? (
              <li className="text-zinc-500">No contact links on file.</li>
            ) : null}
          </ul>
        </section>

        <p className="mt-10 text-center text-xs text-zinc-500">
          Preview demo site — not affiliated with{" "}
          {b.name?.trim() || "this business"}.
        </p>
      </article>
    </>
  );
}
