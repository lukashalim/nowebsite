"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useCallback } from "react";
import { buildCrmExportQueryString, type CrmSearchParams } from "@/lib/crm-params";

interface CrmExportButtonProps {
  params: CrmSearchParams;
  isPro: boolean;
}

export function CrmExportButton({ params, isPro }: CrmExportButtonProps) {
  const exportCsv = useCallback(() => {
    const qs = buildCrmExportQueryString(params, { isPro });
    const url = qs ? `/api/crm-export${qs}` : "/api/crm-export";
    window.location.href = url;
  }, [params, isPro]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <Download className="size-4" aria-hidden />
        {isPro ? "Export all CSV" : "Export page CSV"}
      </button>
      {isPro ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          All matching leads
        </span>
      ) : (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Page {params.page} only ·{" "}
          <Link href="/pro" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
            Pro
          </Link>{" "}
          exports all matches
        </span>
      )}
    </div>
  );
}
