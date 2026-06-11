"use client";

import { Download } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { DirectoryBusiness } from "@/lib/directory/types";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import { directoryOutlineButtonClass } from "@/lib/directory/ui-classes";

const SESSION_EMAIL_KEY = "csv_download_email";

interface DownloadCsvButtonProps {
  businesses: DirectoryBusiness[];
  pagePath: string;
  label?: string;
  className?: string;
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

export function DownloadCsvButton({
  businesses,
  pagePath,
  label = "Download CSV",
  className,
}: DownloadCsvButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const downloadPageCsv = useCallback(() => {
    const csv = buildDirectoryBusinessesCsv(businesses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(blob, csvFilenameFromPagePath(pagePath));
  }, [businesses, pagePath]);

  const submitDownload = useCallback(
    async (submittedEmail: string) => {
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
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(data?.error ?? "Something went wrong. Please try again.");
          return;
        }

        setSessionEmail(submittedEmail);
        dialogRef.current?.close();
        downloadPageCsv();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setPending(false);
      }
    },
    [pagePath, downloadPageCsv],
  );

  const handleClick = useCallback(() => {
    const savedEmail = getSessionEmail();
    if (savedEmail) {
      void submitDownload(savedEmail);
      return;
    }
    setEmail("");
    setError(null);
    dialogRef.current?.showModal();
  }, [submitDownload]);

  const buttonClass = className ?? `${directoryOutlineButtonClass} gap-2`;

  return (
    <>
      <div className="flex justify-center sm:justify-start">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || businesses.length === 0}
          className={buttonClass}
        >
          <Download className="size-4" aria-hidden />
          {pending ? "Preparing…" : label}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(100vw-2rem,28rem)] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        onClose={() => {
          setError(null);
          setEmail("");
        }}
      >
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
              Download CSV
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Enter your email to download this page as CSV. We&apos;ll send
              occasional updates.
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
              {pending ? "Submitting…" : "Download"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
