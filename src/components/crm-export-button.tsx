"use client";

import { Download, Lock } from "lucide-react";
import { useCallback } from "react";
import { buildCrmQueryString, type CrmSearchParams } from "@/lib/crm-params";

interface CrmExportButtonProps {
  params: CrmSearchParams;
  isPro: boolean;
}

export function CrmExportButton({ params, isPro }: CrmExportButtonProps) {
  const exportCsv = useCallback(() => {
    const qs = buildCrmQueryString(params);
    const url = qs ? `/api/crm-export${qs}` : "/api/crm-export";
    window.location.href = url;
  }, [params]);

  if (!isPro) {
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
        >
          <Download className="size-4" aria-hidden />
          Export CSV
          <Lock className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      <Download className="size-4" aria-hidden />
      Export CSV
    </button>
  );
}
