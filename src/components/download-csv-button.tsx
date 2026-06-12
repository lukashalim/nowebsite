"use client";

import { Download } from "lucide-react";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { buildDirectoryCsvDownloadUrl } from "@/lib/directory/csv-download-url";
import { FREE_DIRECTORY_CSV_MAX_PAGES } from "@/lib/directory-csv-limits";
import { directoryOutlineButtonClass } from "@/lib/directory/ui-classes";

interface DownloadCsvButtonProps {
  exportAccess: DirectoryContactAccess;
  pagePath: string;
  pageSize: number;
  totalPages: number;
  isPro?: boolean;
  label?: string;
  className?: string;
}

export function DownloadCsvButton({
  exportAccess,
  pagePath,
  pageSize,
  totalPages,
  isPro = false,
  label = "Download CSV",
  className,
}: DownloadCsvButtonProps) {
  const cappedExport = !isPro && totalPages > FREE_DIRECTORY_CSV_MAX_PAGES;
  const buttonClass = className ?? `${directoryOutlineButtonClass} gap-2`;

  function handleClick() {
    const url = buildDirectoryCsvDownloadUrl({
      exportAccess,
      pagePath,
      pageSize,
      totalPages,
    });
    window.location.href = url;
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button
        type="button"
        onClick={handleClick}
        className={buttonClass}
      >
        <Download className="size-4" aria-hidden />
        {label}
      </button>
      {cappedExport ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Free exports are capped at the first {FREE_DIRECTORY_CSV_MAX_PAGES}{" "}
          pages of results.
        </p>
      ) : null}
    </div>
  );
}
