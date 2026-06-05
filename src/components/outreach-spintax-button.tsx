"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { buildFacebookListingSpintax } from "@/lib/outreach-spintax";

interface OutreachSpintaxButtonProps {
  placeId: string;
  businessName: string | null;
  mainCategory: string | null;
  businessType: string | null;
  eligible: boolean;
}

export function OutreachSpintaxButton({
  placeId,
  businessName,
  mainCategory,
  businessType,
  eligible,
}: OutreachSpintaxButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!eligible) {
    return <span className="text-zinc-400">—</span>;
  }

  async function copy() {
    const message = buildFacebookListingSpintax({
      placeId,
      name: businessName,
      mainCategory,
      businessType,
    });
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
