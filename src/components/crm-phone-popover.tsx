"use client";

import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordOutreachUsage } from "@/app/actions/crm-usage";
import { buildOutreachMessage } from "@/lib/outreach-spintax";
import { normalizePhoneE164, type PhoneCountry } from "@/lib/phone-lookup";
import {
  filterSpintaxTemplatesForLeadChannel,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import type { CrmUsageAction } from "@/lib/crm-limits";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface CrmPhonePopoverProps {
  phone: string;
  country?: PhoneCountry | null;
  userId: string;
  placeId: string;
  businessName: string | null;
  mainCategory: string | null;
  businessType: string | null;
  leadAudience: SpintaxAudience;
  templates: SpintaxTemplate[];
  outreachRemaining: number | null;
  onOutreachRecorded?: (
    remaining: number | null,
    action: CrmUsageAction,
  ) => void;
}

type SmsFlowState = "idle" | "checking" | "confirm_landline" | "confirm_unverified";

interface PendingSms {
  e164: string;
  message: string;
}

interface LookupPhoneApiResponse {
  ok: boolean;
  e164?: string;
  classification?: string;
  reason?: string;
}

function lastSmsTemplateStorageKey(userId: string): string {
  return `crm:lastSmsSpintaxTemplateId:${userId}`;
}

function normalizePhoneForTel(phone: string): string {
  return phone.replace(/\s/g, "");
}

export function CrmPhonePopover({
  phone,
  country,
  userId,
  placeId,
  businessName,
  mainCategory,
  businessType,
  leadAudience,
  templates,
  outreachRemaining,
  onOutreachRecorded,
}: CrmPhonePopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [smsFlowState, setSmsFlowState] = useState<SmsFlowState>("idle");
  const [pendingSms, setPendingSms] = useState<PendingSms | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const outreachBlocked = outreachRemaining === 0;

  const matchingTemplates = useMemo(
    () => filterSpintaxTemplatesForLeadChannel(templates, "sms", leadAudience),
    [templates, leadAudience],
  );

  const telHref = `tel:${normalizePhoneForTel(phone)}`;
  const smsPhoneE164 = normalizePhoneE164(phone, country ?? "US");

  useEffect(() => {
    if (matchingTemplates.length === 0) return;
    const stored = window.localStorage.getItem(lastSmsTemplateStorageKey(userId));
    if (stored && matchingTemplates.some((t) => t.id === stored)) {
      setSelectedId(stored);
      return;
    }
    setSelectedId(matchingTemplates[0].id);
  }, [matchingTemplates, userId]);

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

  useEffect(() => {
    if (!open) {
      setSmsFlowState("idle");
      setPendingSms(null);
      setLimitError(null);
    }
  }, [open]);

  const selectedTemplate =
    matchingTemplates.find((t) => t.id === selectedId) ?? matchingTemplates[0];

  async function recordSmsUsage(): Promise<boolean> {
    const usage = await recordOutreachUsage("sms", placeId);
    if (!usage.ok) {
      setLimitError(usage.error);
      onOutreachRecorded?.(usage.remaining, "sms");
      return false;
    }
    onOutreachRecorded?.(usage.remaining, "sms");
    setLimitError(null);
    return true;
  }

  async function openSmsLink(pending: PendingSms) {
    const ok = await recordSmsUsage();
    if (!ok) return;
    window.location.href = `sms:${pending.e164}?body=${encodeURIComponent(pending.message)}`;
    setOpen(false);
    setSmsFlowState("idle");
    setPendingSms(null);
  }

  function resetSmsFlow() {
    setSmsFlowState("idle");
    setPendingSms(null);
  }

  async function startSendSms() {
    if (!selectedTemplate || !smsPhoneE164) return;

    if (outreachBlocked) {
      setLimitError("Monthly outreach limit reached.");
      return;
    }

    const message = buildOutreachMessage(selectedTemplate.template, {
      name: businessName,
      mainCategory,
      businessType,
    });
    window.localStorage.setItem(
      lastSmsTemplateStorageKey(userId),
      selectedTemplate.id,
    );

    setSmsFlowState("checking");
    setPendingSms(null);

    try {
      const res = await fetch("/api/lookup-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, country: country ?? "US" }),
      });

      let data: LookupPhoneApiResponse | null = null;
      try {
        data = (await res.json()) as LookupPhoneApiResponse;
      } catch {
        data = null;
      }

      const pending: PendingSms = {
        e164: data?.ok === true && data.e164 ? data.e164 : smsPhoneE164,
        message,
      };

      if (data?.ok === true && data.classification === "mobile") {
        await openSmsLink(pending);
        return;
      }

      if (data?.ok === true && data.classification === "landline_or_voip") {
        setPendingSms(pending);
        setSmsFlowState("confirm_landline");
        return;
      }

      setPendingSms(pending);
      setSmsFlowState("confirm_unverified");
    } catch {
      setPendingSms({
        e164: smsPhoneE164,
        message,
      });
      setSmsFlowState("confirm_unverified");
    }
  }

  function confirmSendAnyway() {
    if (!pendingSms) return;
    void openSmsLink(pendingSms);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Phone className="size-3.5" aria-hidden />
        {phone}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Phone actions"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="space-y-3">
            <a
              href={telHref}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              Call
            </a>

            <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                SMS
              </p>
              {outreachBlocked ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Limit reached ·{" "}
                  <Link
                    href="/pro"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Upgrade
                  </Link>
                </p>
              ) : matchingTemplates.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No SMS templates match this lead type.
                </p>
              ) : smsFlowState === "confirm_landline" ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    This appears to be a landline — SMS may not deliver. Send
                    anyway?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmSendAnyway}
                      className="flex-1 rounded-md bg-accent px-2 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                    >
                      Send anyway
                    </button>
                    <button
                      type="button"
                      onClick={resetSmsFlow}
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : smsFlowState === "confirm_unverified" ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Couldn&apos;t verify number type. Send anyway?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmSendAnyway}
                      className="flex-1 rounded-md bg-accent px-2 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                    >
                      Send anyway
                    </button>
                    <button
                      type="button"
                      onClick={resetSmsFlow}
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={selectedTemplate?.id ?? ""}
                    disabled={smsFlowState === "checking"}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
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
                    onClick={() => void startSendSms()}
                    disabled={
                      !selectedTemplate || !smsPhoneE164 || smsFlowState === "checking"
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    <MessageSquare className="size-4" aria-hidden />
                    {smsFlowState === "checking" ? "Checking number..." : "Send SMS"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
