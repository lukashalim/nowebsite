"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface CheckAngiListingButtonProps {
  placeId: string;
  hasAngiListing: boolean | null | undefined;
}

export function CheckAngiListingButton({
  placeId,
  hasAngiListing,
}: CheckAngiListingButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/angi-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? `Check failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  const label = hasAngiListing == null ? "Check Angi" : "Re-check Angi";

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => void runCheck()}
        disabled={busy}
        className="text-[11px] font-medium text-blue-600 hover:underline disabled:opacity-60 dark:text-blue-400"
      >
        {busy ? "Checking…" : label}
      </button>
      {error ? (
        <span className="max-w-[10rem] text-[10px] leading-snug text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
