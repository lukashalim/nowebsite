"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordOutreachUsage } from "@/app/actions/crm-usage";
import { incrementContactCount } from "@/app/actions/update-contact";
import { buildOutreachMessage } from "@/lib/outreach-spintax";
import {
  filterSpintaxTemplatesForLeadChannel,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import type { CrmUsageAction } from "@/lib/crm-limits";
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
  outreachRemaining: number | null;
  onOutreachRecorded?: (
    remaining: number | null,
    action: CrmUsageAction,
  ) => void;
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
  outreachRemaining,
  onOutreachRecorded,
  onContactCountChange,
}: OutreachSpintaxButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [limitError, setLimitError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const outreachBlocked = outreachRemaining === 0;

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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!eligible || matchingTemplates.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }

  if (outreachBlocked) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Limit reached ·{" "}
        <Link href="/pro" className="text-blue-600 hover:underline dark:text-blue-400">
          Upgrade
        </Link>
      </span>
    );
  }

  const selectedTemplate =
    matchingTemplates.find((t) => t.id === selectedId) ?? matchingTemplates[0];

  async function copyDm(template: SpintaxTemplate) {
    const usage = await recordOutreachUsage("dm", placeId);
    if (!usage.ok) {
      setLimitError(usage.error);
      onOutreachRecorded?.(usage.remaining, "dm");
      return false;
    }

    onOutreachRecorded?.(usage.remaining, "dm");

    const message = buildOutreachMessage(template.template, {
      name: businessName,
      mainCategory,
      businessType,
    });
    await navigator.clipboard.writeText(message);
    window.localStorage.setItem(
      lastUsedStorageKey(userId, leadAudience),
      template.id,
    );
    setSelectedId(template.id);
    setLimitError(null);
    return true;
  }

  async function copyOnly() {
    const ok = await copyDm(selectedTemplate);
    if (!ok) return;
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyAndOpenFacebook() {
    if (!facebookHref) return;
    const ok = await copyDm(selectedTemplate);
    if (!ok) return;
    window.open(facebookHref, "_blank", "noopener,noreferrer");
    setOpen(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);

    const res = await incrementContactCount(placeId);
    if (res.ok) {
      onContactCountChange?.(res.contactCount);
    }
  }

  const triggerClass = facebookHref
    ? "inline-flex whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
    : "text-sm font-medium text-accent transition-colors hover:text-accent-hover";

  return (
    <>
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={triggerClass}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {facebookHref
            ? "DM on Facebook"
            : copied
              ? "Copied"
              : "Copy DM"}
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="DM spintax"
            className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Template
              </p>
              <select
                value={selectedTemplate.id}
                aria-label="DM spintax template"
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {matchingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {limitError ? (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {limitError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  void (facebookHref ? copyAndOpenFacebook() : copyOnly())
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <MessageSquare className="size-4" aria-hidden />
                {facebookHref ? "Send DM" : "Copy message"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

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
