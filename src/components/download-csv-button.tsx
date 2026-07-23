"use client";

import { ChevronDown, Download } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { buildDirectoryCsvDownloadUrl } from "@/lib/directory/csv-download-url";
import { LIST_PURCHASE_FREE_ROWS_CLIENT } from "@/lib/directory/buy-full-list";
import { BuyFullListCheckoutModal } from "@/components/buy-full-list-checkout-modal";
import { directoryOutlineButtonClass } from "@/lib/directory/ui-classes";

interface DownloadCsvButtonProps {
  exportAccess: DirectoryContactAccess;
  pagePath: string;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  /** Slug for GA4 csv_purchase_click (category/city pages). */
  categoryOrCity?: string;
  isPro?: boolean;
  label?: string;
  className?: string;
}

export function DownloadCsvButton({
  exportAccess,
  pagePath,
  pageSize,
  totalPages,
  totalCount,
  categoryOrCity,
  isPro = false,
  label = "Download CSV",
  className,
}: DownloadCsvButtonProps) {
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const buttonClass = className ?? `${directoryOutlineButtonClass} gap-2`;

  const freeLabel =
    totalCount > pageSize
      ? "Current page — Free (100 max)"
      : "Current page — Free";

  const remainingRows = Math.max(0, totalCount - LIST_PURCHASE_FREE_ROWS_CLIENT);
  const canBuyFullList =
    remainingRows > 0 &&
    (exportAccess.scope.startsWith("category:") ||
      exportAccess.scope.startsWith("city:"));
  const paidLabel = `Remaining ${remainingRows.toLocaleString()} records — $9`;

  const downloadUrl = buildDirectoryCsvDownloadUrl({
    exportAccess,
    pagePath,
    pageSize,
    totalPages,
  });

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  function handleFreeDownload() {
    closeMenu();
    window.location.href = downloadUrl;
  }

  function handlePaidClick() {
    closeMenu();
    setCheckoutOpen(true);
  }

  if (isPro) {
    return (
      <div className="flex flex-col items-center sm:items-start">
        <button
          type="button"
          onClick={handleFreeDownload}
          className={buttonClass}
        >
          <Download className="size-4" aria-hidden />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center sm:items-start"
    >
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClass}
      >
        <Download className="size-4" aria-hidden />
        {label}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="absolute top-full z-20 mt-1 min-w-[min(100%,20rem)] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleFreeDownload}
            className="flex w-full px-4 py-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {freeLabel}
          </button>
          {canBuyFullList ? (
            <button
              type="button"
              role="menuitem"
              onClick={handlePaidClick}
              className="flex w-full border-t border-zinc-100 px-4 py-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              {paidLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {canBuyFullList ? (
        <BuyFullListCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          exportAccess={exportAccess}
          pagePath={pagePath}
          remainingRows={remainingRows}
          categoryOrCity={categoryOrCity}
          placement="bottom"
        />
      ) : null}
    </div>
  );
}
