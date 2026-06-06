"use client";

import { useEffect, useMemo, useState } from "react";
import { incrementContactCount } from "@/app/actions/update-contact";
import { buildOutreachMessage } from "@/lib/outreach-spintax";
import {
  filterSpintaxTemplatesForLeadChannel,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface OutreachSpintaxButtonProps {
  placeId: string;
  userId: string;
  businessName: string | null;
  mainCategory: string | null;
  businessType: string | null;
  eligible: boolean;
  leadAudience: SpintaxAudience;
  templates: SpintaxTemplate[];
  facebookUrl?: string | null;
  onContactCountChange?: (next: number) => void;
}

function lastUsedStorageKey(userId: string, leadAudience: SpintaxAudience): string {
  return `crm:lastSpintaxTemplateId:${userId}:${leadAudience}`;
}

function normalizeFacebookUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function OutreachSpintaxButton({
  placeId,
  userId,
  businessName,
  mainCategory,
  businessType,
  eligible,
  leadAudience,
  templates,
  facebookUrl,
  onContactCountChange,
}: OutreachSpintaxButtonProps) {
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const matchingTemplates = useMemo(
    () =>
      filterSpintaxTemplatesForLeadChannel(templates, "facebook", leadAudience),
    [templates, leadAudience],
  );

  const facebookHref = facebookUrl?.trim() ? normalizeFacebookUrl(facebookUrl) : null;

  useEffect(() => {
    if (matchingTemplates.length === 0) return;
    const stored = window.localStorage.getItem(
      lastUsedStorageKey(userId, leadAudience),
    );
    if (stored && matchingTemplates.some((t) => t.id === stored)) {
      setSelectedId(stored);
      return;
    }
    setSelectedId(matchingTemplates[0].id);
  }, [matchingTemplates, userId, leadAudience]);

  if (!eligible || matchingTemplates.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }

  const selectedTemplate =
    matchingTemplates.find((t) => t.id === selectedId) ?? matchingTemplates[0];

  async function copyDm() {
    const message = buildOutreachMessage(selectedTemplate.template, {
      name: businessName,
      mainCategory,
      businessType,
    });
    await navigator.clipboard.writeText(message);
    window.localStorage.setItem(
      lastUsedStorageKey(userId, leadAudience),
      selectedTemplate.id,
    );
  }

  async function copyOnly() {
    await copyDm();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyAndOpenFacebook() {
    if (!facebookHref) return;
    await copyDm();
    window.open(facebookHref, "_blank", "noopener,noreferrer");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);

    const res = await incrementContactCount(placeId);
    if (res.ok) {
      onContactCountChange?.(res.contactCount);
    }
  }

  if (facebookHref) {
    return (
      <>
        <button
          type="button"
          onClick={() => void copyAndOpenFacebook()}
          className="inline-flex whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          DM on Facebook
        </button>
        {toastVisible ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            DM copied — Facebook opened
          </div>
        ) : null}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copyOnly()}
      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
    >
      {copied ? "Copied" : "Copy DM"}
    </button>
  );
}
