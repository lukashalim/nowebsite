"use client";

import { useState } from "react";
import type { DirectoryContactAccess } from "@/lib/directory/contact-fields";
import { BuyFullListCheckoutModal } from "@/components/buy-full-list-checkout-modal";
import { LIST_PURCHASE_FREE_ROWS_CLIENT } from "@/lib/directory/buy-full-list";

interface BuyFullListCtaProps {
  categoryOrCity: string;
  exportAccess: DirectoryContactAccess;
  pagePath: string;
  totalCount: number;
}

export function BuyFullListCta({
  categoryOrCity,
  exportAccess,
  pagePath,
  totalCount,
}: BuyFullListCtaProps) {
  const [open, setOpen] = useState(false);
  const remainingRows = Math.max(0, totalCount - LIST_PURCHASE_FREE_ROWS_CLIENT);

  if (remainingRows <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
      >
        Just want this list? Get the full export — $9
      </button>
      <BuyFullListCheckoutModal
        open={open}
        onClose={() => setOpen(false)}
        exportAccess={exportAccess}
        pagePath={pagePath}
        remainingRows={remainingRows}
        categoryOrCity={categoryOrCity}
        placement="top"
      />
    </>
  );
}
