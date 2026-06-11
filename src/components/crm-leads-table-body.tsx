"use client";

import { useState } from "react";
import {
  ExternalLink,
  MapPin,
  Star,
} from "lucide-react";
import { ContactCountSelect } from "@/components/contact-count-select";
import { CrmPhonePopover } from "@/components/crm-phone-popover";
import { MarkInvalidButton } from "@/components/mark-invalid-button";
import { NotesCell } from "@/components/notes-cell";
import { OutreachSpintaxButton } from "@/components/outreach-spintax-button";
import { OwnerNameInput } from "@/components/owner-name-input";
import { StageSelect } from "@/components/stage-select";
import type { BusinessLead } from "@/lib/business";
import type { CrmWebPresence } from "@/lib/crm-params";
import { demoPublicPath } from "@/lib/demo-slug";
import {
  isEligibleForCrmSpintax,
  resolveFacebookPageUrl,
} from "@/lib/outreach-spintax";
import { leadSpintaxAudience } from "@/lib/spintax-audience";
import type { SpintaxTemplate } from "@/lib/spintax-templates";
import { ProFeatureLock } from "@/components/pro-gate-overlay";

interface CrmLeadsTableBodyProps {
  rows: BusinessLead[];
  userId: string;
  webPresence: CrmWebPresence;
  spintaxTemplates: SpintaxTemplate[];
  isPro: boolean;
}

function initialContactCounts(rows: BusinessLead[]): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [row.place_id, row.contact_count ?? 0]),
  );
}

export function CrmLeadsTableBody({
  rows,
  userId,
  webPresence,
  spintaxTemplates,
  isPro,
}: CrmLeadsTableBodyProps) {
  const [contactCounts, setContactCounts] = useState(() =>
    initialContactCounts(rows),
  );

  function setContactCountForPlace(placeId: string, next: number) {
    setContactCounts((prev) => ({ ...prev, [placeId]: next }));
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={12}
          className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
        >
          No rows match these filters.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((b) => {
        const outreachRow = {
          place_id: b.place_id,
          name: b.name,
          facebook_url: b.facebook_url,
          crm_contact_surface: b.crm_contact_surface ?? null,
          listing_website: b.listing_website,
        };
        const spintaxEligible = isEligibleForCrmSpintax(
          webPresence,
          outreachRow,
        );
        const spintaxLeadAudience = leadSpintaxAudience(outreachRow);
        const contactCount = contactCounts[b.place_id] ?? b.contact_count ?? 0;

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
                <CrmPhonePopover
                  phone={b.phone}
                  country={b.country}
                  userId={userId}
                  businessName={b.name}
                  mainCategory={b.main_category}
                  businessType={b.business_type}
                  leadAudience={spintaxLeadAudience}
                  templates={spintaxTemplates}
                  isPro={isPro}
                />
              ) : (
                "—"
              )}
            </td>
            <td className="px-3 py-3 align-top">
              {!isPro ? (
                <ProFeatureLock label="DM Spintax" />
              ) : (
                <OutreachSpintaxButton
                  placeId={b.place_id}
                  userId={userId}
                  businessName={b.name}
                  mainCategory={b.main_category}
                  businessType={b.business_type}
                  eligible={spintaxEligible}
                  leadAudience={spintaxLeadAudience}
                  templates={spintaxTemplates}
                  facebookUrl={resolveFacebookPageUrl(outreachRow)}
                  onContactCountChange={(next) =>
                    setContactCountForPlace(b.place_id, next)
                  }
                />
              )}
            </td>
            <td className="px-3 py-3">
              {!isPro ? (
                <ProFeatureLock label="Demo" />
              ) : (
                <a
                  href={demoPublicPath(b)}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Demo
                </a>
              )}
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
                placeId={b.place_id}
                value={contactCount}
                onValueChange={(next) => setContactCountForPlace(b.place_id, next)}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
