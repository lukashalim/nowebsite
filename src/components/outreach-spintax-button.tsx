"use client";

import { useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";

interface OutreachSpintaxButtonProps {
  placeId: string;
  eligible: boolean;
}

export function OutreachSpintaxButton({
  placeId,
  eligible,
}: OutreachSpintaxButtonProps) {
  const [loading, setLoading] = useState(false);
  const [spintax, setSpintax] = useState<string | null>(null);
  const [shortName, setShortName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  if (!eligible) {
    return <span className="text-zinc-400">—</span>;
  }

  async function run() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/outreach-spintax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = (await res.json()) as { spintax?: string; shortName?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (!data.spintax) {
        throw new Error("No spintax in response");
      }
      setSpintax(data.spintax);
      setShortName(data.shortName ?? null);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!spintax) return;
    await navigator.clipboard.writeText(spintax);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center justify-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : null}
        Spintax
      </button>
      {error ? (
        <p className="max-w-[200px] text-[10px] leading-tight text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {open && spintax ? (
        <div className="mt-1 space-y-1 rounded-md border border-zinc-200 bg-white p-2 text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {shortName ? (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Short name: <span className="font-medium text-zinc-700 dark:text-zinc-300">{shortName}</span>
            </p>
          ) : null}
          <textarea
            readOnly
            value={spintax}
            rows={4}
            className="w-full resize-y rounded border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={copy}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {copied ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <Copy className="size-3" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-zinc-300 px-2 py-1 text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Hide
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
