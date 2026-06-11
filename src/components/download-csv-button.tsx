"use client";

import { Download, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectoryBusinessPublic } from "@/lib/directory/contact-fields";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { fetchDirectoryContacts } from "@/lib/directory/contact-api-client";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import type { DirectoryBusiness } from "@/lib/directory/types";
import { directoryOutlineButtonClass } from "@/lib/directory/ui-classes";
import { UpgradeToProButton } from "@/components/upgrade-to-pro-button";
import { FREE_MONTHLY_DIRECTORY_CSV_LIMIT } from "@/lib/directory-csv-limits";

const SESSION_EMAIL_KEY = "csv_download_email";
const TOAST_DURATION_MS = 4000;
const CONFIRMATION_POLL_MS = 5000;

type DialogStep = "email_entry" | "awaiting_confirmation";

interface DownloadCsvButtonProps {
  businesses: DirectoryBusinessPublic[];
  contactAccess: DirectoryContactAccess;
  pagePath: string;
  label?: string;
  className?: string;
}

interface CsvDownloadErrorResponse {
  error?: string;
  code?: string;
  used?: number;
  limit?: number;
}

interface CsvDownloadStatusResponse {
  isPro?: boolean;
  used?: number;
  remaining?: number;
  limit?: number;
  emailConfirmed?: boolean;
}

interface CsvDownloadSuccessResponse {
  ok: boolean;
  remaining: number | null;
  limit: number | null;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getSessionEmail(): string | null {
  try {
    return sessionStorage.getItem(SESSION_EMAIL_KEY);
  } catch {
    return null;
  }
}

function setSessionEmail(email: string): void {
  try {
    sessionStorage.setItem(SESSION_EMAIL_KEY, email);
  } catch {
    // Ignore storage errors.
  }
}

function mergeContactsIntoBusinesses(
  businesses: DirectoryBusinessPublic[],
  contacts: Awaited<ReturnType<typeof fetchDirectoryContacts>>,
): DirectoryBusiness[] {
  return businesses.map((b, i) => {
    const contact = contacts.find((c) => c.i === i);
    return {
      ...b,
      phone: contact?.phone ?? null,
      google_maps_link: contact?.google_maps_link ?? null,
    };
  });
}

export function DownloadCsvButton({
  businesses,
  contactAccess,
  pagePath,
  label = "Download CSV",
  className,
}: DownloadCsvButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const limitDialogRef = useRef<HTMLDialogElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [dialogStep, setDialogStep] = useState<DialogStep>("email_entry");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [remaining, setRemaining] = useState(FREE_MONTHLY_DIRECTORY_CSV_LIMIT);
  const [limit, setLimit] = useState(FREE_MONTHLY_DIRECTORY_CSV_LIMIT);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const limitReached = statusLoaded && !isPro && remaining === 0;

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const showLimitDialog = useCallback(() => {
    stopPolling();
    dialogRef.current?.close();
    limitDialogRef.current?.showModal();
  }, [stopPolling]);

  const showLastPageToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const fetchEmailStatus = useCallback(
    async (checkEmail: string): Promise<CsvDownloadStatusResponse | null> => {
      try {
        const response = await fetch(
          `/api/csv-download?email=${encodeURIComponent(checkEmail)}`,
        );
        if (!response.ok) return null;
        return (await response.json()) as CsvDownloadStatusResponse;
      } catch {
        return null;
      }
    },
    [],
  );

  const refreshStatus = useCallback(async (sessionEmail?: string | null) => {
    const emailParam = sessionEmail ?? getSessionEmail();
    const url = emailParam
      ? `/api/csv-download?email=${encodeURIComponent(emailParam)}`
      : "/api/csv-download";

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const data = (await response.json()) as CsvDownloadStatusResponse;
      if (data.isPro) {
        setIsPro(true);
        setStatusLoaded(true);
        return;
      }

      setIsPro(false);
      setRemaining(data.remaining ?? FREE_MONTHLY_DIRECTORY_CSV_LIMIT);
      setLimit(data.limit ?? FREE_MONTHLY_DIRECTORY_CSV_LIMIT);
      setStatusLoaded(true);
    } catch {
      setStatusLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      stopPolling();
    };
  }, [refreshStatus, stopPolling]);

  const downloadPageCsv = useCallback(async () => {
    const contacts = await fetchDirectoryContacts(contactAccess);
    const merged = mergeContactsIntoBusinesses(businesses, contacts);
    const csv = buildDirectoryBusinessesCsv(merged);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(blob, csvFilenameFromPagePath(pagePath));
  }, [businesses, contactAccess, pagePath]);

  const submitDownload = useCallback(
    async (submittedEmail: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPending(true);
      setError(null);

      try {
        const response = await fetch("/api/csv-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: submittedEmail,
            pageUrl: pagePath,
            mode: "page" as const,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | CsvDownloadErrorResponse
            | null;
          if (data?.code === "csv_limit_reached") {
            setRemaining(0);
            setLimit(data.limit ?? FREE_MONTHLY_DIRECTORY_CSV_LIMIT);
            setStatusLoaded(true);
            showLimitDialog();
            return;
          }
          if (data?.code === "email_confirmation_required") {
            setSessionEmail(submittedEmail);
            setPendingEmail(submittedEmail);
            setDialogStep("awaiting_confirmation");
            dialogRef.current?.showModal();
            return;
          }
          setError(data?.error ?? "Something went wrong. Please try again.");
          return;
        }

        const data = (await response.json()) as CsvDownloadSuccessResponse;
        setSessionEmail(submittedEmail);
        stopPolling();
        setDialogStep("email_entry");
        dialogRef.current?.close();

        if (data.remaining !== null && data.limit !== null) {
          setRemaining(data.remaining);
          setLimit(data.limit);
          if (data.remaining === 1) {
            showLastPageToast();
          }
        }

        await refreshStatus(submittedEmail);
        await downloadPageCsv();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        submittingRef.current = false;
        setPending(false);
      }
    },
    [
      pagePath,
      downloadPageCsv,
      showLimitDialog,
      showLastPageToast,
      refreshStatus,
      stopPolling,
    ],
  );

  const checkConfirmationAndPoll = useCallback(
    async (checkEmail: string) => {
      if (submittingRef.current || pending) return;
      const data = await fetchEmailStatus(checkEmail);
      if (!data) return;
      if (data.emailConfirmed) {
        void submitDownload(checkEmail);
      }
    },
    [fetchEmailStatus, submitDownload, pending],
  );

  useEffect(() => {
    if (dialogStep !== "awaiting_confirmation" || !pendingEmail) {
      stopPolling();
      return;
    }

    void checkConfirmationAndPoll(pendingEmail);

    pollIntervalRef.current = setInterval(() => {
      void checkConfirmationAndPoll(pendingEmail);
    }, CONFIRMATION_POLL_MS);

    return stopPolling;
  }, [dialogStep, pendingEmail, checkConfirmationAndPoll, stopPolling]);

  const handleClick = useCallback(async () => {
    if (pending || businesses.length === 0) return;

    if (limitReached) {
      showLimitDialog();
      return;
    }

    const savedEmail = getSessionEmail();
    if (savedEmail) {
      if (!isPro) {
        const data = await fetchEmailStatus(savedEmail);
        if (data?.emailConfirmed === false) {
          setPendingEmail(savedEmail);
          setDialogStep("awaiting_confirmation");
          setError(null);
          dialogRef.current?.showModal();
          return;
        }
      }
      void submitDownload(savedEmail);
      return;
    }

    setEmail("");
    setPendingEmail("");
    setDialogStep("email_entry");
    setError(null);
    dialogRef.current?.showModal();
  }, [
    limitReached,
    pending,
    businesses.length,
    showLimitDialog,
    submitDownload,
    isPro,
    fetchEmailStatus,
  ]);

  const buttonClass = className ?? `${directoryOutlineButtonClass} gap-2`;
  const buttonDisabled = pending || businesses.length === 0;
  const buttonLooksDisabled = limitReached || buttonDisabled;

  return (
    <>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <button
          type="button"
          onClick={() => void handleClick()}
          aria-disabled={buttonLooksDisabled || undefined}
          className={`${buttonClass}${buttonLooksDisabled ? " cursor-not-allowed opacity-50" : ""}`}
        >
          <Download className="size-4" aria-hidden />
          {pending ? "Preparing…" : label}
        </button>
        {!isPro ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Export Page to CSV ({remaining} of {limit} free monthly pages
            remaining)
          </p>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(100vw-2rem,28rem)] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        onClose={() => {
          stopPolling();
          setError(null);
          setEmail("");
          setPendingEmail("");
          setDialogStep("email_entry");
        }}
      >
        {dialogStep === "email_entry" ? (
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = email.trim();
              if (!trimmed) {
                setError("Email is required.");
                return;
              }
              void submitDownload(trimmed);
            }}
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Export Page to CSV
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Enter your email. We&apos;ll send a confirmation link — click
                it, then your download will start.
              </p>
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              disabled={pending}
              value={email}
              aria-label="Email address"
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              onChange={(e) => setEmail(e.target.value)}
            />
            {error ? (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {pending ? "Submitting…" : "Continue"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col items-center text-center">
              <Mail
                className="size-8 text-zinc-400 dark:text-zinc-500"
                aria-hidden
              />
              <h2 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Confirm your email
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Check your inbox for a confirmation email from us, then click
                the link. This page will detect when you&apos;re confirmed and
                start your download automatically.
              </p>
              {pendingEmail ? (
                <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {pendingEmail}
                </p>
              ) : null}
            </div>
            {error ? (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                onClick={() => {
                  setError(null);
                  void submitDownload(pendingEmail);
                }}
              >
                {pending ? "Checking…" : "I've confirmed — try again"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={limitDialogRef}
        className="w-[min(100vw-2rem,28rem)] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="flex flex-col items-center p-6 text-center">
          <Lock
            className="size-8 text-zinc-400 dark:text-zinc-500"
            aria-hidden
          />
          <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Monthly export limit reached
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;ve used your {FREE_MONTHLY_DIRECTORY_CSV_LIMIT} free page
            exports for this month. Upgrade to Pro for $27/mo to get unlimited,
            full-database bulk CSV downloads instantly.
          </p>
          <div className="mt-4 flex w-full flex-col gap-2">
            <UpgradeToProButton className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" />
            <Link
              href="/pro"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Compare Free vs Pro
            </Link>
          </div>
          <button
            type="button"
            className="mt-4 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            onClick={() => limitDialogRef.current?.close()}
          >
            Close
          </button>
        </div>
      </dialog>

      {toastVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          You&apos;re on your last free page export this month.
        </div>
      ) : null}
    </>
  );
}
