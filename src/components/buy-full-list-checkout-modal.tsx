"use client";

import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { trackCsvPurchaseClick } from "@/lib/analytics";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

interface BuyFullListCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  exportAccess: DirectoryContactAccess;
  pagePath: string;
  remainingRows: number;
  categoryOrCity?: string;
  /** GA placement: top CTA vs download menu */
  placement?: "top" | "bottom";
}

type Phase = "loading" | "checkout" | "fulfilling" | "ready" | "error";

async function pollForDownload(sessionId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(
      `/api/stripe/buy-full-list/status?session_id=${encodeURIComponent(sessionId)}`,
    );
    const data = (await res.json()) as {
      status?: string;
      downloadUrl?: string;
      error?: string;
    };
    if (res.ok && data.status === "ready" && data.downloadUrl) {
      return data.downloadUrl;
    }
    if (res.ok && data.status === "failed") {
      throw new Error(data.error ?? "Fulfillment failed");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    "Payment received, but the CSV is still preparing. Use Retry download in a moment.",
  );
}

function triggerBrowserDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function BuyFullListCheckoutModal({
  open,
  onClose,
  exportAccess,
  pagePath,
  remainingRows,
  categoryOrCity,
  placement = "bottom",
}: BuyFullListCheckoutModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const cleanupCheckout = useCallback(() => {
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    cleanupCheckout();
    startedRef.current = false;
    setPhase("loading");
    setError(null);
    setSessionId(null);
    onClose();
  }, [cleanupCheckout, onClose]);

  const startFulfillment = useCallback(async (id: string) => {
    setPhase("fulfilling");
    setError(null);
    try {
      const downloadUrl = await pollForDownload(id);
      triggerBrowserDownload(downloadUrl);
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, []);

  const startCheckout = useCallback(async () => {
    setPhase("loading");
    setError(null);

    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    if (!publishableKey) {
      throw new Error("Stripe publishable key is not configured");
    }

    const res = await fetch("/api/stripe/buy-full-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: exportAccess.scope,
        token: exportAccess.token,
        pagePath,
        state: exportAccess.filters.stateSlug ?? undefined,
        city: exportAccess.filters.citySlug ?? undefined,
        minReviews:
          exportAccess.filters.minReviews > 0
            ? String(exportAccess.filters.minReviews)
            : undefined,
      }),
    });
    const data = (await res.json()) as {
      clientSecret?: string;
      sessionId?: string;
      error?: string;
    };
    if (!res.ok || !data.clientSecret || !data.sessionId) {
      throw new Error(data.error ?? "Could not start checkout");
    }

    setSessionId(data.sessionId);

    const stripe = await loadStripe(publishableKey);
    if (!stripe) throw new Error("Failed to load Stripe.js");

    cleanupCheckout();
    const checkout = await stripe.createEmbeddedCheckoutPage({
      clientSecret: data.clientSecret,
      onComplete: () => {
        cleanupCheckout();
        void startFulfillment(data.sessionId!);
      },
    });

    checkoutRef.current = checkout;
    if (mountRef.current) {
      checkout.mount(mountRef.current);
      setPhase("checkout");
    }
  }, [cleanupCheckout, exportAccess, pagePath, startFulfillment]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function boot() {
      if (startedRef.current) return;
      startedRef.current = true;

      if (categoryOrCity) {
        trackCsvPurchaseClick(categoryOrCity, placement);
      }

      try {
        await startCheckout();
        if (cancelled) cleanupCheckout();
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setError(err instanceof Error ? err.message : "Checkout failed");
        startedRef.current = false;
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    categoryOrCity,
    placement,
    startCheckout,
    cleanupCheckout,
  ]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-full-list-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="buy-full-list-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Get the remaining list
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;ve used your free download. Get the remaining{" "}
              <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {remainingRows.toLocaleString()}
              </span>{" "}
              records for $9.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-[320px] flex-1 overflow-y-auto px-5 py-4">
          {phase === "loading" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Preparing secure checkout…
            </p>
          ) : null}
          {phase === "fulfilling" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Payment received. Generating your CSV…
            </p>
          ) : null}
          {phase === "ready" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Download started. You can close this window.
            </p>
          ) : null}
          {phase === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error ?? "Something went wrong"}
              </p>
              {sessionId ? (
                <button
                  type="button"
                  onClick={() => void startFulfillment(sessionId)}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
                >
                  Retry download
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    startedRef.current = false;
                    void (async () => {
                      startedRef.current = true;
                      try {
                        await startCheckout();
                      } catch (err) {
                        setPhase("error");
                        setError(
                          err instanceof Error ? err.message : "Checkout failed",
                        );
                        startedRef.current = false;
                      }
                    })();
                  }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
                >
                  Try again
                </button>
              )}
            </div>
          ) : null}
          <div
            ref={mountRef}
            className={phase === "checkout" ? "block" : "hidden"}
          />
        </div>
      </div>
    </div>
  );
}
