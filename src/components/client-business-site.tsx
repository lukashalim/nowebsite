import Image from "next/image";
import {
  Clock3,
  ExternalLink,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import type { DemoBusiness } from "@/lib/crm-cohort";
import type { ClientSite } from "@/lib/client-sites";
import { buildLocalBusinessJsonLd } from "@/lib/demo-local-business-jsonld";
import { openStreetMapLink } from "@/lib/demo-enrichment";
import { ClientSitePageBeacon } from "@/components/client-site-page-beacon";
import {
  ClientSiteServiceFlow,
  ClientSiteServicePeek,
  ClientSiteServices,
} from "@/components/client-site-services";
import {
  ClientSiteCallLink,
  ClientSiteOutboundLink,
} from "@/components/client-site-tracked-link";

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return `tel:${phone.replace(/\s/g, "")}`;
}

function formatHoursLine(hour: {
  day: string;
  opens?: string;
  closes?: string;
  text?: string;
}): string {
  if (hour.text) return `${hour.day}: ${hour.text}`;
  if (hour.opens && hour.closes) {
    return `${hour.day}: ${hour.opens} – ${hour.closes}`;
  }
  return hour.day;
}

interface ClientBusinessSiteProps {
  site: ClientSite;
  business: DemoBusiness;
}

export function ClientBusinessSite({
  site,
  business,
}: ClientBusinessSiteProps) {
  const phone = business.phone?.trim() || null;
  const callHref = phone ? telHref(phone) : null;
  const cityState =
    [business.city, business.state].filter(Boolean).join(", ") || "";
  const locLine =
    [business.city, business.state, business.postal_code]
      .filter(Boolean)
      .join(", ") || "";
  const aroundLine = business.postal_code?.trim()
    ? `Homes and properties around ${business.postal_code.trim()}`
    : cityState
      ? `Homes and properties around ${cityState}`
      : "Homes and properties nearby";
  const showHeroAside = Boolean(site.heroImageSrc) || site.services.length > 0;
  const osm = openStreetMapLink(
    business.latitude ?? null,
    business.longitude ?? null,
  );
  const reviews = (business.review_highlights ?? []).slice(0, 8);
  const hours = business.hours ?? [];
  const jsonLd = buildLocalBusinessJsonLd(business, "/", {
    pageUrl: site.origin,
    description: site.description,
  });
  if (site.logoSrc) {
    jsonLd.logo = `${site.origin}${site.logoSrc}`;
  }

  return (
    <>
      <ClientSitePageBeacon siteId={site.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-[#f4efe3] text-[#1b2b1c]" style={{ colorScheme: "light" }}>
        <ClientSiteServiceFlow
          siteId={site.id}
          services={site.services}
          shortDba={site.shortDba}
        >
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d9d0bc] bg-[#f7f3e9]/95 shadow-[0_1px_0_0_rgba(61,45,31,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <a href="#top" className="flex min-w-0 items-center">
              {site.logoSrc ? (
                <Image
                  src={site.logoSrc}
                  alt={site.name}
                  width={1120}
                  height={957}
                  className="h-11 w-auto sm:h-12"
                  sizes="48px"
                  priority
                />
              ) : (
                <span className="truncate font-semibold tracking-tight">
                  {site.name}
                </span>
              )}
            </a>
            <nav
              aria-label="Page"
              className="hidden items-center gap-6 text-sm font-medium text-[#3d5340] sm:flex"
            >
              <a href="#services" className="hover:text-[#1b2b1c]">
                Services
              </a>
              <a href="#reviews" className="hover:text-[#1b2b1c]">
                Reviews
              </a>
              <a href="#contact" className="hover:text-[#1b2b1c]">
                Contact
              </a>
            </nav>
            {callHref ? (
              <ClientSiteCallLink
                href={callHref}
                siteId={site.id}
                location="header"
                aria-label={`Call ${phone}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#2f6b3a] text-white hover:bg-[#245830]"
              >
                <Phone className="size-5" aria-hidden />
              </ClientSiteCallLink>
            ) : null}
          </div>
        </header>

        <main id="top" className="pt-[4.25rem] sm:pt-[4.5rem]">
          <section className="bg-[#1b3a2a] text-[#f4efe3]">
            <div
              className={`mx-auto grid max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 ${showHeroAside ? "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]" : ""}`}
            >
              <div>
                {cityState ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4a35a]">
                    {cityState}
                  </p>
                ) : null}
                <h1 className="mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {site.tagline}
                </h1>
                <p className="mt-3 text-base text-[#e4dcc8] sm:text-lg">
                  {aroundLine}
                </p>
                {business.rating != null ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-[#f4efe3]">
                    <Star
                      className="size-5 fill-[#c4a35a] text-[#c4a35a]"
                      aria-hidden
                    />
                    <span className="tabular-nums">
                      {Number(business.rating).toFixed(1)}
                      {business.reviews != null
                        ? ` · ${business.reviews} Google reviews`
                        : ""}
                    </span>
                  </p>
                ) : null}
                {callHref ? (
                  <div className="mt-5">
                    <ClientSiteCallLink
                      href={callHref}
                      siteId={site.id}
                      location="hero"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#c4a35a] px-6 py-3 text-base font-semibold text-[#1b2b1c] hover:bg-[#b39148]"
                    >
                      <Phone className="size-5" aria-hidden />
                      Call {phone} for a quote
                    </ClientSiteCallLink>
                  </div>
                ) : null}
              </div>
              {site.heroImageSrc ? (
                <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl lg:block">
                  <Image
                    src={site.heroImageSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="320px"
                    priority
                  />
                </div>
              ) : (
                <ClientSiteServicePeek />
              )}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
            <h2 className="text-2xl font-bold tracking-tight">About us</h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-[#3d5340]">
              {site.about}
            </p>
          </section>

          <section
            id="services"
            className="scroll-mt-24 border-y border-[#d9d0bc] bg-[#f7f3e9] py-10"
          >
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <h2 className="text-2xl font-bold tracking-tight">Services</h2>
              <p className="mt-2 text-sm text-[#3d5340]">
                Tap a service. Leave your address and phone — the owner gets a
                text.
              </p>
              <ClientSiteServices />
            </div>
          </section>

          {reviews.length > 0 ? (
            <section id="reviews" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-14 sm:px-6">
              <h2 className="text-2xl font-bold tracking-tight">
                What customers are saying
              </h2>
              <ul className="mt-8 grid gap-4">
                {reviews.map((review) => (
                  <li
                    key={`${review.reviewer_name ?? "review"}-${review.excerpt.slice(0, 24)}`}
                    className="rounded-2xl border border-[#d9d0bc] bg-white p-5 shadow-sm"
                  >
                    {typeof review.rating === "number" ? (
                      <p className="inline-flex items-center gap-1 text-[#c4a35a]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`size-4 ${i < Math.round(review.rating ?? 0) ? "fill-[#c4a35a]" : "text-[#d9d0bc]"}`}
                            aria-hidden
                          />
                        ))}
                        <span className="sr-only">
                          {review.rating} out of 5 stars
                        </span>
                      </p>
                    ) : null}
                    <p className="mt-3 leading-relaxed text-[#1b2b1c]">
                      “{review.excerpt}”
                    </p>
                    <p className="mt-3 text-sm font-medium text-[#3d5340]">
                      {review.reviewer_name || "Google reviewer"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            id="contact"
            className="scroll-mt-24 border-t border-[#d9d0bc] bg-[#f7f3e9] py-14"
          >
            <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:grid-cols-2 sm:px-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Contact</h2>
                <ul className="mt-6 space-y-4 text-[#3d5340]">
                  {phone && callHref ? (
                    <li>
                      <ClientSiteCallLink
                        href={callHref}
                        siteId={site.id}
                        location="contact"
                        className="inline-flex items-center gap-2 font-medium text-[#1b3a2a] hover:underline"
                      >
                        <Phone className="size-4" aria-hidden />
                        {phone}
                      </ClientSiteCallLink>
                    </li>
                  ) : null}
                  {business.address || locLine ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        {business.address ? (
                          <>
                            {business.address}
                            <br />
                          </>
                        ) : null}
                        {locLine}
                      </span>
                    </li>
                  ) : null}
                  {business.google_maps_link ? (
                    <li>
                      <ClientSiteOutboundLink
                        href={business.google_maps_link}
                        siteId={site.id}
                        label="Google Maps"
                        location="contact"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-[#1b3a2a] hover:underline"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        Google Maps
                      </ClientSiteOutboundLink>
                    </li>
                  ) : null}
                  {osm ? (
                    <li>
                      <ClientSiteOutboundLink
                        href={osm}
                        siteId={site.id}
                        label="OpenStreetMap"
                        location="contact"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-[#1b3a2a] hover:underline"
                      >
                        <MapPin className="size-4" aria-hidden />
                        OpenStreetMap
                      </ClientSiteOutboundLink>
                    </li>
                  ) : null}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Hours & service area
                </h2>
                {hours.length > 0 ? (
                  <ul className="mt-6 space-y-1 text-[#3d5340]">
                    {hours.map((hour) => (
                      <li
                        key={`${hour.day}-${hour.opens ?? hour.text ?? ""}`}
                        className="flex items-start gap-2"
                      >
                        <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {formatHoursLine(hour)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-6 text-[#3d5340]">
                    Call to schedule a visit.
                  </p>
                )}
                <p className="mt-6 leading-relaxed text-[#3d5340]">
                  {site.areaServed}
                </p>
              </div>
            </div>
          </section>
        </main>
        </ClientSiteServiceFlow>

        <footer className="border-t border-[#d9d0bc] bg-[#1b3a2a] px-4 py-8 text-center text-sm text-[#e4dcc8] sm:px-6">
          {site.logoSrc ? (
            <Image
              src={site.logoSrc}
              alt=""
              width={1120}
              height={957}
              className="mx-auto h-16 w-auto"
              sizes="64px"
            />
          ) : null}
          <p className={site.logoSrc ? "mt-3 font-semibold text-[#f4efe3]" : "font-semibold text-[#f4efe3]"}>
            {site.name}
          </p>
          <p className="mt-2">
            {locLine}
            {phone ? ` · ${phone}` : ""}
          </p>
        </footer>
      </div>
    </>
  );
}
