import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { CrmFilters, CrmPagination } from "@/components/crm-filters";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { ContactCountSelect } from "@/components/contact-count-select";
import { MarkInvalidButton } from "@/components/mark-invalid-button";
import { NotesCell } from "@/components/notes-cell";
import { OutreachSpintaxButton } from "@/components/outreach-spintax-button";
import { OwnerNameInput } from "@/components/owner-name-input";
import { StageSelect } from "@/components/stage-select";
import { fetchCrmBusinessRows } from "@/lib/crm-cohort";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { demoPublicPath } from "@/lib/demo-slug";
import { tryParseCrmSearchParams } from "@/lib/crm-params";
import {
  isEligibleForCrmSpintax,
  resolveFacebookPageUrl,
} from "@/lib/outreach-spintax";
import { leadSpintaxAudience } from "@/lib/spintax-audience";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function CrmPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

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
          href={CRM_BASE_PATH}
          className="mt-4 inline-block text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          Reset to defaults
        </Link>
      </div>
    );
  }

  const p = parsed.data;
  const [{ rows, total, error: loadErr }, spintaxResult] = await Promise.all([
    fetchCrmBusinessRows(p, user.id),
    listSpintaxTemplates(),
  ]);
  const loadError = loadErr;
  const spintaxTemplates = spintaxResult.ok ? spintaxResult.templates : [];

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[1400px]">
      <header className="space-y-2">
        <CrmNav active="leads" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          No-website leads
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Browse verified local businesses without websites. Filter by category,
          rating, and outreach stage. Use the DM Spintax button to copy a
          personalized cold outreach message.
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
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <th className="px-3 py-3">Business</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Reviews</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">DM Spintax</th>
                  <th className="px-3 py-3">Demo</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3">Bad Lead</th>
                  <th className="px-3 py-3">Contacted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No rows match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => {
                    const outreachRow = {
                      place_id: b.place_id,
                      name: b.name,
                      facebook_url: b.facebook_url,
                      crm_contact_surface: b.crm_contact_surface ?? null,
                      listing_website: b.listing_website,
                    };
                    const spintaxEligible = isEligibleForCrmSpintax(
                      p.webPresence,
                      outreachRow,
                    );
                    const spintaxLeadAudience = leadSpintaxAudience(outreachRow);
                    return (
                      <tr
                        key={b.place_id}
                        className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                      >
                        <td className="px-3 py-3 font-medium capitalize text-zinc-900 dark:text-zinc-100">
                          {b.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">
                          <span className="inline-flex items-start gap-1.5">
                            <MapPin
                              className="mt-0.5 size-3.5 shrink-0 text-zinc-400"
                              aria-hidden
                            />
                            <span>
                              {[b.city, b.state, b.postal_code]
                                .filter(Boolean)
                                .join(", ") || b.address || "—"}
                            </span>
                            {b.google_maps_link ? (
                              <a
                                href={b.google_maps_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 shrink-0 text-zinc-400 transition-colors hover:text-accent"
                                title="Open in Google Maps"
                                aria-label="Open in Google Maps"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                              </a>
                            ) : null}
                          </span>
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
                        <td className="px-3 py-3 align-top">
                          <OutreachSpintaxButton
                            userId={user.id}
                            businessName={b.name}
                            mainCategory={b.main_category}
                            businessType={b.business_type}
                            eligible={spintaxEligible}
                            leadAudience={spintaxLeadAudience}
                            templates={spintaxTemplates}
                            facebookUrl={resolveFacebookPageUrl(outreachRow)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={demoPublicPath(b)}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Demo
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <StageSelect
                            key={`${b.place_id}-${b.stage}`}
                            placeId={b.place_id}
                            value={b.stage}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <OwnerNameInput
                            key={`${b.place_id}-owner-${b.owner_name ?? ""}`}
                            placeId={b.place_id}
                            value={b.owner_name}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <NotesCell
                            key={`${b.place_id}-notes-${b.notes ?? ""}`}
                            placeId={b.place_id}
                            value={b.notes}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <MarkInvalidButton placeId={b.place_id} />
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
