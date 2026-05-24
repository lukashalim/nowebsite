"use client";

import { Download } from "lucide-react";
import { useCallback } from "react";
import type { DirectoryBusiness } from "@/lib/directory/types";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";

interface DownloadCsvButtonProps {
  businesses: DirectoryBusiness[];
  pagePath: string;
}

export function DownloadCsvButton({
  businesses,
  pagePath,
}: DownloadCsvButtonProps) {
  const download = useCallback(() => {
    const csv = buildDirectoryBusinessesCsv(businesses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilenameFromPagePath(pagePath);
    a.click();
    URL.revokeObjectURL(url);
  }, [businesses, pagePath]);

  return (
    <div className="flex justify-center sm:justify-start">
      <button
        type="button"
        onClick={download}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <Download className="size-4" aria-hidden />
        Download CSV
      </button>
    </div>
  );
}
