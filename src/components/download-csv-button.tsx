"use client";

import { Download } from "lucide-react";
import { useCallback } from "react";
import type { DirectoryBusiness } from "@/lib/directory/types";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import { directoryOutlineButtonClass } from "@/lib/directory/ui-classes";

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
        className={`${directoryOutlineButtonClass} gap-2`}
      >
        <Download className="size-4" aria-hidden />
        Download CSV
      </button>
    </div>
  );
}
