"use client";

import { ChevronLeft, ChevronRight, Loader2, MessageSquare, PhoneOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { updateNotes } from "@/app/actions/update-notes";
import { recordPhoneCallUsage } from "@/app/actions/crm-usage";
import type { CallScriptSteps } from "@/lib/call-script-steps";
import type { CrmUsageAction } from "@/lib/crm-limits";
import {
  initiateOutboundCall,
  sendOutboundSMS,
  terminateCall,
} from "@/lib/actions/outreach";
import { normalizePhoneE164, type PhoneCountry } from "@/lib/phone-lookup";
import { shortenBusinessNameForOutreach } from "@/lib/outreach-spintax";

export interface CallLeadData {
  placeId: string;
  name: string | null;
  phone: string;
  company: string | null;
  scriptSteps: CallScriptSteps;
  demoUrl: string;
  existingNotes: string | null;
}

export type CallModalPhase = "IDLE" | "CONNECTING" | "TALKING" | "COMPLETED";

type ScriptStepKey = keyof CallScriptSteps;

const SCRIPT_STEP_ORDER: ScriptStepKey[] = ["hook", "pivot", "offer"];
const SCRIPT_STEP_LABELS: Record<ScriptStepKey, string> = {
  hook: "Hook",
  pivot: "Pivot",
  offer: "Offer",
};

interface CallSessionOverlayProps {
  userId: string;
  phoneCountry?: PhoneCountry | null;
  phase: CallModalPhase;
  leadData: CallLeadData | null;
  outreachRemaining: number | null;
  onClose: () => void;
  onPhaseChange: (phase: CallModalPhase) => void;
  onOutreachRecorded?: (
    remaining: number | null,
    action: CrmUsageAction,
  ) => void;
}

interface LookupPhoneApiResponse {
  ok: boolean;
  e164?: string;
  classification?: string;
  reason?: string;
}

function displayName(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed || "this lead";
}

function normalizePhoneForTel(phone: string): string {
  return phone.replace(/\s/g, "");
}

function buildDefaultSmsBody(
  businessName: string | null,
  demoUrl: string,
): string {
  const shortName = shortenBusinessNameForOutreach(businessName);
  return `Hey ${shortName}, Lukas here. I called about a quick fix for your Google listing—the missing website link: ${demoUrl}`;
}

export function CallSessionOverlay({
  userId,
  phoneCountry,
  phase,
  leadData,
  outreachRemaining,
  onClose,
  onPhaseChange,
  onOutreachRecorded,
}: CallSessionOverlayProps) {
  const router = useRouter();
  const initiatedRef = useRef(false);
  const callSidRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [scriptStepIndex, setScriptStepIndex] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingHangUp, setPendingHangUp] = useState(false);
  const [pendingSms, setPendingSms] = useState(false);
  const [smsToast, setSmsToast] = useState<string | null>(null);

  const outreachBlocked = outreachRemaining === 0;

  useEffect(() => {
    if (phase === "IDLE" || !leadData) {
      initiatedRef.current = false;
      callSidRef.current = null;
      roomIdRef.current = null;
      setCallError(null);
      setSmsError(null);
      setScriptStepIndex(0);
      return;
    }
    setDraftNotes(leadData.existingNotes ?? "");
    setSmsBody(buildDefaultSmsBody(leadData.name, leadData.demoUrl));
  }, [phase, leadData]);

  useEffect(() => {
    if (phase !== "CONNECTING" || !leadData) return;
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    const e164 = normalizePhoneE164(leadData.phone, phoneCountry ?? "US");
    const telHref = `tel:${normalizePhoneForTel(leadData.phone)}`;

    void (async () => {
      if (!e164) {
        void recordPhoneCallUsage(leadData.placeId);
        window.location.href = telHref;
        onPhaseChange("TALKING");
        return;
      }

      const result = await initiateOutboundCall(userId, e164, leadData.placeId);

      if (result.type === "ERROR") {
        setCallError(result.error);
        return;
      }

      if (result.type === "FALLBACK") {
        window.location.href = telHref;
      } else if (result.type === "TWILIO") {
        callSidRef.current = result.callSid;
        roomIdRef.current = result.roomId;
      }

      onPhaseChange("TALKING");
    })();
  }, [phase, leadData, userId, phoneCountry, onPhaseChange]);

  useEffect(() => {
    if (!smsToast) return;
    const timer = window.setTimeout(() => setSmsToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [smsToast]);

  if (phase === "IDLE" || !leadData) {
    return null;
  }

  const leadLabel = displayName(leadData.name);
  const currentStepKey = SCRIPT_STEP_ORDER[scriptStepIndex] ?? "hook";
  const currentStepLabel = SCRIPT_STEP_LABELS[currentStepKey];
  const currentStepText = leadData.scriptSteps[currentStepKey];

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

  async function handleHangUp() {
    if (pendingHangUp) return;

    const callSid = callSidRef.current;
    if (callSid) {
      setPendingHangUp(true);
      const result = await terminateCall(
        userId,
        callSid,
        roomIdRef.current ?? undefined,
      );
      setPendingHangUp(false);
      if (!result.ok) {
        setCallError(result.error);
        return;
      }
      callSidRef.current = null;
      roomIdRef.current = null;
    }

    onPhaseChange("COMPLETED");
  }

  async function handleSendSms() {
    if (pendingSms || outreachBlocked) return;

    const trimmedBody = smsBody.trim();
    if (!trimmedBody) {
      setSmsError("Message cannot be empty");
      return;
    }

    const fallbackE164 = normalizePhoneE164(
      leadData!.phone,
      phoneCountry ?? "US",
    );
    if (!fallbackE164) {
      setSmsError("Invalid phone number");
      return;
    }

    setPendingSms(true);
    setSmsError(null);

    try {
      const res = await fetch("/api/lookup-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: leadData!.phone,
          country: phoneCountry ?? "US",
        }),
      });

      let data: LookupPhoneApiResponse | null = null;
      try {
        data = (await res.json()) as LookupPhoneApiResponse;
      } catch {
        data = null;
      }

      if (data?.ok !== true || data.classification !== "mobile") {
        setSmsError("Not a mobile number — SMS blocked");
        setPendingSms(false);
        return;
      }

      const e164 = data.e164 ?? fallbackE164;
      const result = await sendOutboundSMS(
        userId,
        e164,
        trimmedBody,
        leadData!.placeId,
      );

      if (result.type === "ERROR") {
        setSmsError(result.error);
        if (typeof result.remaining === "number") {
          onOutreachRecorded?.(result.remaining, "sms");
        }
        setPendingSms(false);
        return;
      }

      onOutreachRecorded?.(result.remaining, "sms");

      if (result.type === "FALLBACK") {
        window.location.href = `sms:${result.e164}?body=${encodeURIComponent(result.message)}`;
      } else {
        setSmsToast("SMS sent via business line");
      }
    } catch {
      setSmsError("Failed to verify phone number");
    }

    setPendingSms(false);
  }

  return (
    <>
      <div
        role="dialog"
        aria-label={`Call with ${leadLabel}`}
        aria-modal="true"
        className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[400px] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-50 shadow-2xl"
      >
        <div className="shrink-0 border-b border-zinc-700 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-white">
                {leadData.name?.trim() || "Unknown lead"}
              </h2>
              {leadData.company?.trim() ? (
                <p className="truncate text-xs text-zinc-400">
                  {leadData.company}
                </p>
              ) : null}
              <p className="truncate text-xs font-medium text-zinc-300">
                {leadData.phone}
              </p>
            </div>
            {phase === "CONNECTING" ? (
              <Loader2
                className="size-5 shrink-0 animate-spin text-amber-400"
                aria-hidden
              />
            ) : null}
          </div>
          {phase === "CONNECTING" ? (
            <p className="mt-2 text-sm font-medium text-amber-300">
              Connecting to {leadLabel}…
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {callError ? (
            <p className="text-xs font-medium text-red-400" role="alert">
              {callError}
            </p>
          ) : null}

          {phase === "TALKING" || phase === "COMPLETED" ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Script — {currentStepLabel}
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {scriptStepIndex + 1} / {SCRIPT_STEP_ORDER.length}
                  </span>
                </div>
                <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-base leading-snug text-zinc-100">
                  {currentStepText}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={scriptStepIndex === 0}
                    onClick={() =>
                      setScriptStepIndex((index) => Math.max(0, index - 1))
                    }
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-600 px-2 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={
                      scriptStepIndex >= SCRIPT_STEP_ORDER.length - 1
                    }
                    onClick={() =>
                      setScriptStepIndex((index) =>
                        Math.min(SCRIPT_STEP_ORDER.length - 1, index + 1),
                      )
                    }
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-amber-500/60 bg-amber-500/10 px-2 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    Next Step
                    <ChevronRight className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Notes
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  disabled={pendingSave}
                  value={draftNotes}
                  aria-label="Call notes"
                  className="w-full resize-y rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
                  onChange={(e) => setDraftNotes(e.target.value)}
                />
              </label>

              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  SMS to {leadData.phone}
                </p>
                <textarea
                  rows={3}
                  maxLength={1600}
                  disabled={pendingSms || outreachBlocked}
                  value={smsBody}
                  aria-label="SMS message"
                  className="w-full resize-y rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
                  onChange={(e) => setSmsBody(e.target.value)}
                />
                {outreachBlocked ? (
                  <p className="text-xs text-zinc-500">
                    Monthly outreach limit reached.
                  </p>
                ) : null}
                {smsError ? (
                  <p className="text-xs font-medium text-red-400" role="alert">
                    {smsError}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pendingSms || outreachBlocked}
                  onClick={() => void handleSendSms()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <MessageSquare className="size-4" aria-hidden />
                  {pendingSms ? "Checking number…" : "Send SMS"}
                </button>
              </div>
            </>
          ) : phase === "CONNECTING" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Notes
              </span>
              <textarea
                rows={3}
                disabled
                value={draftNotes}
                aria-label="Call notes"
                className="w-full resize-y rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 opacity-50"
                readOnly
              />
            </label>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-zinc-700 px-4 py-3">
          {phase === "CONNECTING" || phase === "TALKING" ? (
            <button
              type="button"
              disabled={pendingHangUp}
              onClick={() => void handleHangUp()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-500 bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              <PhoneOff className="size-4" aria-hidden />
              {pendingHangUp ? "Hanging up…" : "Hang Up"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={phase !== "COMPLETED" || pendingSave}
            onClick={() => void handleSave()}
            className="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-white disabled:opacity-50"
          >
            {pendingSave ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {smsToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[540px] right-6 z-50 max-w-[360px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          {smsToast}
        </div>
      ) : null}
    </>
  );
}

/** @deprecated Use CallSessionOverlay */
export const CrmCallModal = CallSessionOverlay;
