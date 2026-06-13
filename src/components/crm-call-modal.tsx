"use client";

import { Loader2, PhoneOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { updateNotes } from "@/app/actions/update-notes";
import { initiateOutboundCall } from "@/lib/actions/outreach";
import { normalizePhoneE164, type PhoneCountry } from "@/lib/phone-lookup";

export interface CallLeadData {
  placeId: string;
  name: string | null;
  phone: string;
  company: string | null;
  hook_script: string;
  existingNotes: string | null;
}

export type CallModalPhase = "IDLE" | "CONNECTING" | "TALKING" | "COMPLETED";

interface CrmCallModalProps {
  userId: string;
  phoneCountry?: PhoneCountry | null;
  phase: CallModalPhase;
  leadData: CallLeadData | null;
  onClose: () => void;
  onPhaseChange: (phase: CallModalPhase) => void;
}

function displayName(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed || "this lead";
}

function normalizePhoneForTel(phone: string): string {
  return phone.replace(/\s/g, "");
}

export function CrmCallModal({
  userId,
  phoneCountry,
  phase,
  leadData,
  onClose,
  onPhaseChange,
}: CrmCallModalProps) {
  const router = useRouter();
  const initiatedRef = useRef(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [callError, setCallError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    if (phase === "IDLE" || !leadData) {
      initiatedRef.current = false;
      setCallError(null);
      return;
    }
    setDraftNotes(leadData.existingNotes ?? "");
  }, [phase, leadData]);

  useEffect(() => {
    if (phase !== "CONNECTING" || !leadData) return;
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    const e164 = normalizePhoneE164(leadData.phone, phoneCountry ?? "US");
    const telHref = `tel:${normalizePhoneForTel(leadData.phone)}`;

    void (async () => {
      if (!e164) {
        window.location.href = telHref;
        onPhaseChange("TALKING");
        return;
      }

      const result = await initiateOutboundCall(userId, e164);

      if (result.type === "ERROR") {
        setCallError(result.error);
        return;
      }

      if (result.type === "FALLBACK") {
        window.location.href = telHref;
      }

      onPhaseChange("TALKING");
    })();
  }, [phase, leadData, userId, phoneCountry, onPhaseChange]);

  if (phase === "IDLE" || !leadData) {
    return null;
  }

  const leadLabel = displayName(leadData.name);

  async function handleSave() {
    if (phase !== "COMPLETED" || pendingSave) return;

    const trimmed = draftNotes.trim();
    const previous = (leadData?.existingNotes ?? "").trim();
    if (trimmed === previous) {
      onClose();
      return;
    }

    setPendingSave(true);
    const res = await updateNotes(leadData!.placeId, trimmed || null);
    setPendingSave(false);

    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      window.alert(res.error);
    }
  }

  function handleHangUp() {
    onPhaseChange("COMPLETED");
  }

  return (
    <div
      role="dialog"
      aria-label={`Call with ${leadLabel}`}
      aria-modal="true"
      className="fixed bottom-6 right-6 z-50 w-[min(100vw-2rem,24rem)] rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {leadData.name?.trim() || "Unknown lead"}
            </h2>
            {leadData.company?.trim() ? (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {leadData.company}
              </p>
            ) : null}
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {leadData.phone}
            </p>
          </div>
          {phase === "CONNECTING" ? (
            <Loader2
              className="size-5 shrink-0 animate-spin text-zinc-500"
              aria-hidden
            />
          ) : null}
        </div>

        {phase === "CONNECTING" ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Connecting to {leadLabel}…
          </p>
        ) : null}

        {callError ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {callError}
          </p>
        ) : null}

        {phase === "TALKING" || phase === "COMPLETED" ? (
          <>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Script
              </p>
              <div className="max-h-32 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                {leadData.hook_script}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Notes
              </span>
              <textarea
                rows={4}
                maxLength={2000}
                disabled={pendingSave}
                value={draftNotes}
                aria-label="Call notes"
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                onChange={(e) => setDraftNotes(e.target.value)}
              />
            </label>
          </>
        ) : phase === "CONNECTING" ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Notes
            </span>
            <textarea
              rows={4}
              disabled
              value={draftNotes}
              aria-label="Call notes"
              className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              readOnly
            />
          </label>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {phase === "CONNECTING" || phase === "TALKING" ? (
            <button
              type="button"
              onClick={handleHangUp}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <PhoneOff className="size-4" aria-hidden />
              Hang Up
            </button>
          ) : null}
          <button
            type="button"
            disabled={phase !== "COMPLETED" || pendingSave}
            onClick={() => void handleSave()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pendingSave ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
