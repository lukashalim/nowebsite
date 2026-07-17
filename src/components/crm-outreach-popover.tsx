"use client";

import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveTenantDemoUrl,
  sendOutboundSMS,
} from "@/lib/actions/outreach";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { buildCallScriptSteps } from "@/lib/call-script-steps";
import {
  CallSessionOverlay,
  type CallLeadData,
  type CallModalPhase,
} from "@/components/crm-call-modal";
import { buildEmailContent } from "@/lib/email-template-steps";
import { buildOutreachMessage } from "@/lib/outreach-spintax";
import { normalizePhoneE164, type PhoneCountry } from "@/lib/phone-lookup";
import {
  formatLeadAddressLines,
  isMailableLeadAddress,
} from "@/lib/postcard/address";
import {
  filterSpintaxTemplatesForLeadChannel,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import type { CrmUsageAction } from "@/lib/crm-limits";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

export type OutreachChannel = "call" | "text" | "mail";

interface CrmOutreachPopoverProps {
  phone: string | null;
  country?: PhoneCountry | null;
  userId: string;
  placeId: string;
  businessName: string | null;
  mainCategory: string | null;
  businessType: string | null;
  ownerName: string | null;
  contactEmail: string | null;
  enrichmentEmail: string | null;
  senderName?: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  leadAudience: SpintaxAudience;
  templates: SpintaxTemplate[];
  existingNotes: string | null;
  outreachRemaining: number | null;
  /** Page-level CRM outreach mode from ?outreachMode= */
  pageOutreachMode?: "all" | "call" | "text" | "mail";
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

function lastCallTemplateStorageKey(userId: string): string {
  return `crm:lastCallSpintaxTemplateId:${userId}`;
}

function lastChannelStorageKey(userId: string): string {
  return `crm:lastOutreachChannel:${userId}`;
}

function pickDefaultChannel(input: {
  hasPhone: boolean;
  mailable: boolean;
  stored: string | null;
  pageMode?: "all" | "call" | "text" | "mail";
}): OutreachChannel {
  const pageMode = input.pageMode ?? "all";
  if (pageMode === "call" && input.hasPhone) return "call";
  if (pageMode === "text" && input.hasPhone) return "text";
  if (pageMode === "mail" && input.mailable) return "mail";

  const stored =
    input.stored === "call" || input.stored === "text" || input.stored === "mail"
      ? input.stored
      : null;
  if (stored === "call" && input.hasPhone) return "call";
  if (stored === "text" && input.hasPhone) return "text";
  if (stored === "mail" && input.mailable) return "mail";
  if (input.hasPhone) return "call";
  if (input.mailable) return "mail";
  return "call";
}

export function CrmOutreachPopover({
  phone,
  country,
  userId,
  placeId,
  businessName,
  mainCategory,
  businessType,
  ownerName,
  contactEmail,
  enrichmentEmail,
  senderName,
  address,
  city,
  state,
  postalCode,
  leadAudience,
  templates,
  existingNotes,
  outreachRemaining,
  pageOutreachMode = "all",
  onOutreachRecorded,
}: CrmOutreachPopoverProps) {
  const hasPhone = Boolean(phone?.trim());
  const mailable = isMailableLeadAddress({
    address,
    city,
    state,
    postal_code: postalCode,
  });
  const addressLines = formatLeadAddressLines({
    address,
    city,
    state,
    postal_code: postalCode,
  });

  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<OutreachChannel>("call");
  const [selectedSmsId, setSelectedSmsId] = useState("");
  const [selectedCallId, setSelectedCallId] = useState("");
  const [smsFlowState, setSmsFlowState] = useState<SmsFlowState>("idle");
  const [pendingSms, setPendingSms] = useState<PendingSms | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mailBusy, setMailBusy] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [mailSuccess, setMailSuccess] = useState<string | null>(null);
  const [callPhase, setCallPhase] = useState<CallModalPhase>("IDLE");
  const [callLeadData, setCallLeadData] = useState<CallLeadData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const outreachBlocked = outreachRemaining === 0;

  const smsTemplates = useMemo(
    () => filterSpintaxTemplatesForLeadChannel(templates, "sms", leadAudience),
    [templates, leadAudience],
  );

  const callTemplates = useMemo(
    () => filterSpintaxTemplatesForLeadChannel(templates, "call", leadAudience),
    [templates, leadAudience],
  );

  const smsPhoneE164 = phone
    ? normalizePhoneE164(phone, country ?? "US")
    : null;

  useEffect(() => {
    const stored = window.localStorage.getItem(lastChannelStorageKey(userId));
    setChannel(
      pickDefaultChannel({
        hasPhone,
        mailable,
        stored,
        pageMode: pageOutreachMode,
      }),
    );
  }, [userId, hasPhone, mailable, pageOutreachMode]);

  useEffect(() => {
    if (smsTemplates.length === 0) return;
    const stored = window.localStorage.getItem(lastSmsTemplateStorageKey(userId));
    if (stored && smsTemplates.some((t) => t.id === stored)) {
      setSelectedSmsId(stored);
      return;
    }
    setSelectedSmsId(smsTemplates[0].id);
  }, [smsTemplates, userId]);

  useEffect(() => {
    if (callTemplates.length === 0) return;
    const stored = window.localStorage.getItem(lastCallTemplateStorageKey(userId));
    if (stored && callTemplates.some((t) => t.id === stored)) {
      setSelectedCallId(stored);
      return;
    }
    setSelectedCallId(callTemplates[0].id);
  }, [callTemplates, userId]);

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
      setMailError(null);
    }
  }, [open]);

  const selectedSmsTemplate =
    smsTemplates.find((t) => t.id === selectedSmsId) ?? smsTemplates[0];

  const selectedCallTemplate =
    callTemplates.find((t) => t.id === selectedCallId) ?? callTemplates[0];

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  function selectChannel(next: OutreachChannel) {
    if (next === "call" || next === "text") {
      if (!hasPhone) return;
    }
    if (next === "mail" && !mailable) return;
    setChannel(next);
    window.localStorage.setItem(lastChannelStorageKey(userId), next);
    setMailError(null);
    setLimitError(null);
  }

  function closeCallModal() {
    setCallPhase("IDLE");
    setCallLeadData(null);
  }

  async function openSmsLink(pending: PendingSms) {
    const result = await sendOutboundSMS(
      userId,
      pending.e164,
      pending.message,
      placeId,
    );

    if (result.type === "ERROR") {
      setLimitError(result.error);
      if (typeof result.remaining === "number") {
        onOutreachRecorded?.(result.remaining, "sms");
      }
      return;
    }

    onOutreachRecorded?.(result.remaining, "sms");
    setLimitError(null);

    if (result.type === "FALLBACK") {
      window.location.href = `sms:${result.e164}?body=${encodeURIComponent(result.message)}`;
    } else {
      setToastMessage("SMS sent via business line");
    }

    setOpen(false);
    setSmsFlowState("idle");
    setPendingSms(null);
  }

  function resetSmsFlow() {
    setSmsFlowState("idle");
    setPendingSms(null);
  }

  async function startSendSms() {
    if (!selectedSmsTemplate || !smsPhoneE164 || !phone) return;

    if (outreachBlocked) {
      setLimitError("Monthly outreach limit reached.");
      return;
    }

    const message = buildOutreachMessage(selectedSmsTemplate.template, {
      name: businessName,
      mainCategory,
      businessType,
    });
    window.localStorage.setItem(
      lastSmsTemplateStorageKey(userId),
      selectedSmsTemplate.id,
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

  function handleCall() {
    if (!phone) return;
    void (async () => {
      const callTemplateId = selectedCallId;
      if (!callTemplateId) return;

      const demoResult = await resolveTenantDemoUrl(userId, placeId);
      if (!demoResult.ok) {
        window.alert(demoResult.error);
        return;
      }

      const templatesResult = await listSpintaxTemplates();
      if (!templatesResult.ok) {
        window.alert(templatesResult.error);
        return;
      }

      const freshCallTemplates = filterSpintaxTemplatesForLeadChannel(
        templatesResult.templates,
        "call",
        leadAudience,
      );
      const callTemplate =
        freshCallTemplates.find((t) => t.id === callTemplateId) ??
        freshCallTemplates[0];
      if (!callTemplate) {
        window.alert("No call script matches this lead type.");
        return;
      }

      const tokenOpts = {
        name: businessName,
        ownerName,
        mainCategory,
        businessType,
        demoLink: demoResult.url,
        senderName: senderName?.trim() || null,
      };

      const scriptSteps = buildCallScriptSteps(
        callTemplate.template,
        callTemplate.pivot_template?.trim() ?? "",
        callTemplate.offer_template?.trim() ?? "",
        tokenOpts,
      );

      const freshEmailTemplates = filterSpintaxTemplatesForLeadChannel(
        templatesResult.templates,
        "email",
        leadAudience,
      );
      const emailTemplate =
        freshEmailTemplates.find((t) => t.name === "Demo link") ??
        freshEmailTemplates[0];
      const emailContent = emailTemplate
        ? buildEmailContent(
            emailTemplate.template,
            emailTemplate.pivot_template?.trim() ?? "",
            tokenOpts,
          )
        : {
            subject: `Your demo — ${businessName?.trim() || "your business"}`,
            body: `Hi ${ownerName?.trim() || businessName?.trim() || "there"},\n\nHere's the link to what your site could look like:\n\n${demoResult.url}`,
          };

      window.localStorage.setItem(
        lastCallTemplateStorageKey(userId),
        callTemplate.id,
      );

      setCallLeadData({
        placeId,
        name: businessName,
        phone,
        company: businessName,
        scriptSteps,
        demoUrl: demoResult.url,
        existingNotes,
        contactEmail,
        enrichmentEmail,
        ownerName,
        mainCategory,
        businessType,
        emailSubject: emailContent.subject,
        emailBody: emailContent.body,
      });
      setCallPhase("CONNECTING");
      setOpen(false);
    })();
  }

  async function sendPostcard() {
    if (!mailable || outreachBlocked) return;
    setMailBusy(true);
    setMailError(null);
    setMailSuccess(null);
    try {
      const res = await fetch("/api/crm-postcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          ownerName,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        remaining?: number | null;
        postcardId?: string;
        url?: string | null;
        testMode?: boolean;
      };
      if (!res.ok || !data.ok) {
        setMailError(data.error || "Failed to send postcard");
        if (typeof data.remaining === "number") {
          onOutreachRecorded?.(data.remaining, "mail");
        }
        return;
      }
      onOutreachRecorded?.(
        typeof data.remaining === "number" ? data.remaining : null,
        "mail",
      );
      const label = data.testMode ? "Test postcard created" : "Postcard queued";
      setMailSuccess(
        data.url
          ? `${label}. Preview ready.`
          : `${label}${data.postcardId ? ` (${data.postcardId})` : ""}.`,
      );
      setToastMessage(label);
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setMailError("Network error sending postcard");
    } finally {
      setMailBusy(false);
    }
  }

  if (!hasPhone && !mailable) {
    return <span className="text-zinc-400">—</span>;
  }

  const triggerLabel = hasPhone
    ? phone
    : addressLines[0] ?? "Mail";

  return (
    <>
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex max-w-[11rem] items-center gap-1 truncate text-blue-600 hover:underline dark:text-blue-400"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {hasPhone ? (
            <Phone className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Mail className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{triggerLabel}</span>
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Outreach actions"
            className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div
              className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800"
              role="tablist"
              aria-label="Outreach channel"
            >
              {(
                [
                  { id: "call", label: "Call", enabled: hasPhone },
                  { id: "text", label: "Text", enabled: hasPhone },
                  { id: "mail", label: "Mail", enabled: mailable },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={channel === tab.id}
                  disabled={!tab.enabled}
                  title={
                    !tab.enabled
                      ? tab.id === "mail"
                        ? "Needs street, city, state, ZIP"
                        : "No phone number"
                      : undefined
                  }
                  onClick={() => selectChannel(tab.id)}
                  className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
                    channel === tab.id
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                      : "text-zinc-600 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {channel === "call" ? (
              <div className="space-y-2">
                {callTemplates.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    No call scripts match this lead type.
                  </p>
                ) : (
                  <select
                    value={selectedCallTemplate?.id ?? ""}
                    onChange={(e) => setSelectedCallId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {callTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleCall}
                  disabled={!hasPhone}
                  className="flex w-full items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  Call
                </button>
              </div>
            ) : null}

            {channel === "text" ? (
              <div className="space-y-2">
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
                ) : smsTemplates.length === 0 ? (
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
                      value={selectedSmsTemplate?.id ?? ""}
                      disabled={smsFlowState === "checking"}
                      onChange={(e) => setSelectedSmsId(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      {smsTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {limitError ? (
                      <p
                        className="text-xs text-red-600 dark:text-red-400"
                        role="alert"
                      >
                        {limitError}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void startSendSms()}
                      disabled={
                        !selectedSmsTemplate ||
                        !smsPhoneE164 ||
                        smsFlowState === "checking"
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      <MessageSquare className="size-4" aria-hidden />
                      {smsFlowState === "checking"
                        ? "Checking number..."
                        : "Send SMS"}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {channel === "mail" ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Mail to
                </p>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                  {addressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
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
                ) : (
                  <>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Sends a 4×6 marketing postcard (HTML front, QR back).
                      Addressed to the owner when Suggest finds one, plus the
                      business name. Lob must accept the street address.
                    </p>
                    {mailError ? (
                      <p
                        className="text-xs text-red-600 dark:text-red-400"
                        role="alert"
                      >
                        {mailError}
                      </p>
                    ) : null}
                    {mailSuccess ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {mailSuccess}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void sendPostcard()}
                      disabled={mailBusy || !mailable}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      <Mail className="size-4" aria-hidden />
                      {mailBusy ? "Creating postcard…" : "Send postcard"}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {toastMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            {toastMessage}
          </div>
        ) : null}
      </div>

      {hasPhone ? (
        <CallSessionOverlay
          userId={userId}
          phoneCountry={country}
          phase={callPhase}
          leadData={callLeadData}
          outreachRemaining={outreachRemaining}
          onClose={closeCallModal}
          onPhaseChange={setCallPhase}
          onOutreachRecorded={onOutreachRecorded}
        />
      ) : null}
    </>
  );
}
