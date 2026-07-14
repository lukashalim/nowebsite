"use client";

import { BUY_FULL_LIST_STRIPE_URL } from "@/lib/directory/buy-full-list";
import { trackCsvPurchaseClick } from "@/lib/analytics";

interface BuyFullListCtaProps {
  categoryOrCity: string;
}

export function BuyFullListCta({ categoryOrCity }: BuyFullListCtaProps) {
  return (
    <a
      href={BUY_FULL_LIST_STRIPE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackCsvPurchaseClick(categoryOrCity, "top")}
      className="inline-flex rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
    >
      Just want this list? Get the full export — $9
    </a>
  );
}
