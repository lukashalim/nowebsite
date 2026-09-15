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
import { ClientSiteServices } from "@/components/client-site-services";
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
  const locLine =
    [business.city, business.state, business.postal_code]
      .filter(Boolean)
      .join(", ") || "";
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

  return (
    <>
      <ClientSitePageBeacon siteId={site.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-[#f4efe3] text-[#1b2b1c]" style={{ colorScheme: "light" }}>
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d9d0bc] bg-[#f7f3e9]/95 shadow-[0_1px_0_0_rgba(61,45,31,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <a href="#top" className="min-w-0 truncate font-semibold tracking-tight">
              {site.name}
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
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#2f6b3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245830]"
              >
                <Phone className="size-4" aria-hidden />
                Call {phone}
              </ClientSiteCallLink>
            ) : null}
          </div>
        </header>

        <main id="top" className="pt-[4.75rem]">
          <section className="bg-[#1b3a2a] text-[#f4efe3]">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4a35a]">
                Washington Court House, Ohio
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
                {site.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-[#e4dcc8]">
                {site.tagline} for homes and properties around {locLine || "Ohio"}.
              </p>
              {business.rating != null ? (
                <p className="mt-6 inline-flex items-center gap-2 text-[#f4efe3]">
                  <Star
                    className="size-5 fill-[#c4a35a] text-[#c4a35a]"
                    aria-hidden
                  />
                  <span className="tabular-nums">
                    {Number(business.rating).toFixed(1)} stars
                    {business.reviews != null
                      ? ` · ${business.reviews} Google reviews`
                      : ""}
                  </span>
                </p>
              ) : null}
              {callHref ? (
                <div className="mt-8">
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
          </section>

          <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight">About us</h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-[#3d5340]">
              {site.about}
            </p>
          </section>

          <section
            id="services"
            className="scroll-mt-24 border-y border-[#d9d0bc] bg-[#f7f3e9] py-14"
          >
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <h2 className="text-2xl font-bold tracking-tight">Services</h2>
              <p className="mt-2 text-sm text-[#3d5340]">
                Tap a service. Leave your address and phone — the owner gets a
                text.
              </p>
              <ClientSiteServices
                siteId={site.id}
                services={site.services}
                shortDba={site.shortDba}
              />
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

        <footer className="border-t border-[#d9d0bc] bg-[#1b3a2a] px-4 py-8 text-center text-sm text-[#e4dcc8] sm:px-6">
          <p className="font-semibold text-[#f4efe3]">{site.name}</p>
          <p className="mt-2">
            {locLine}
            {phone ? ` · ${phone}` : ""}
          </p>
        </footer>
      </div>
    </>
  );
}
