import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  MapPin,
  Phone,
  Search,
  Share2,
  Star,
} from "lucide-react";
import { CrmFilters, CrmPagination } from "@/components/crm-filters";
import { ContactCountSelect } from "@/components/contact-count-select";
import { OutreachSpintaxButton } from "@/components/outreach-spintax-button";
import { isEligibleForFacebookListingOutreach } from "@/lib/outreach-spintax";
import type { BusinessLead } from "@/lib/business";
import { fetchCrmBusinessRows } from "@/lib/crm-cohort";
import { tryParseCrmSearchParams } from "@/lib/crm-params";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "No-website leads | Mini CRM",
    description:
      "No-website leads with extracted review excerpts. Filter by reviews, rating, and outreach.",
  };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isWhatsAppListingUrl(href: string | null | undefined): boolean {
  if (!href || typeof href !== "string") return false;
  return /wa\.me|whatsapp\.com/i.test(href);
}

/** Google query: name + location + facebook (to surface their page). */
function googleLookupUrl(b: BusinessLead): string | null {
  const name = b.name?.trim() || b.business_type?.trim();
  const loc =
    [b.city, b.state, b.postal_code].filter(Boolean).join(" ").trim() ||
    b.address?.trim() ||
    "";
  if (!name && !loc) return null;
  const q = [name, loc, "facebook"]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export default async function Home({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = tryParseCrmSearchParams(raw);

  if (!parsed.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Invalid filters
        </h1>
        <ul className="mt-2 list-inside list-disc text-sm text-red-600">
          {parsed.issues.map((issue) => (
            <li key={`${issue.path.join(".")}-${issue.message}`}>
              {issue.path.length ? `${issue.path.join(".")}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          Reset to defaults
        </Link>
      </div>
    );
  }

  const p = parsed.data;
  const { rows, total, error: loadErr } = await fetchCrmBusinessRows(p);
  const loadError = loadErr;

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[1400px]">
      <header className="space-y-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/scrape-progress"
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Scrape queue →
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          No-website leads
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Only listings with review excerpts saved from Maps (for demos). Default:
          no standalone website (25–199 reviews, 4+ stars). Use Has website to narrow
          to Facebook / WhatsApp listing URLs or businesses with a real site.{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            DM spintax
          </span>{" "}
          uses DeepSeek (
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            DEEPSEEK_API_KEY
          </code>
          ) for Facebook-on-GMB leads.
        </p>
      </header>

      <CrmFilters params={p} />

      {loadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">Could not load data</p>
          <p className="mt-1 opacity-90">{loadError}</p>
          <p className="mt-2 text-xs opacity-80">
            Set <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            in <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">.env.local</code>.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <th className="px-3 py-3">Business</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Reviews</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Links</th>
                  <th className="px-3 py-3">DM spintax</th>
                  <th className="px-3 py-3">Demo</th>
                  <th className="px-3 py-3">Contacted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No rows match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => {
                    const googleLook = googleLookupUrl(b);
                    const spintaxEligible = isEligibleForFacebookListingOutreach({
                      place_id: b.place_id,
                      name: b.name,
                      facebook_url: b.facebook_url,
                      crm_contact_surface: b.crm_contact_surface ?? null,
                      listing_website: b.listing_website,
                    });
                    return (
                    <tr
                      key={b.place_id}
                      className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {b.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">
                        <span className="inline-flex items-start gap-1">
                          <MapPin
                            className="mt-0.5 size-3.5 shrink-0 text-zinc-400"
                            aria-hidden
                          />
                          <span>
                            {[b.city, b.state, b.postal_code]
                              .filter(Boolean)
                              .join(", ") || b.address || "—"}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-3 text-zinc-600 dark:text-zinc-300">
                        {b.business_type ?? b.main_category ?? "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
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
                      <td className="px-3 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                        {b.reviews ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {b.phone ? (
                          <a
                            href={`tel:${b.phone.replace(/\s/g, "")}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <Phone className="size-3.5" aria-hidden />
                            {b.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {googleLook ? (
                            <a
                              href={googleLook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
                              title="Google: business name, location, and Facebook"
                            >
                              <Search className="size-3.5" aria-hidden />
                              Google
                            </a>
                          ) : null}
                          {b.google_maps_link ? (
                            <a
                              href={b.google_maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
                              title="Google Maps"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              Maps
                            </a>
                          ) : null}
                          {b.facebook_url ? (
                            <a
                              href={b.facebook_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:underline dark:text-blue-400"
                              title="Facebook"
                            >
                              <Share2 className="size-3.5" aria-hidden />
                              FB
                            </a>
                          ) : null}
                          {b.listing_website &&
                          isWhatsAppListingUrl(b.listing_website) ? (
                            <a
                              href={
                                b.listing_website.startsWith("http")
                                  ? b.listing_website
                                  : `https://${b.listing_website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline dark:text-emerald-400"
                              title="WhatsApp (Maps listing website)"
                            >
                              WA
                            </a>
                          ) : null}
                          {b.crm_contact_surface === "facebook" ||
                          b.crm_contact_surface === "whatsapp" ? (
                            <span
                              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              title="Contact surface (generated)"
                            >
                              {b.crm_contact_surface}
                            </span>
                          ) : null}
                          {!googleLook &&
                          !b.google_maps_link &&
                          !b.facebook_url &&
                          !(
                            b.listing_website &&
                            isWhatsAppListingUrl(b.listing_website)
                          )
                            ? "—"
                            : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <OutreachSpintaxButton
                          placeId={b.place_id}
                          eligible={spintaxEligible}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={`/demo/${encodeURIComponent(b.place_id)}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Demo
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <ContactCountSelect
                          key={`${b.place_id}-${b.contact_count ?? 0}`}
                          placeId={b.place_id}
                          value={b.contact_count ?? 0}
                        />
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <CrmPagination params={p} total={total} />
        </>
      )}
    </div>
  );
}
