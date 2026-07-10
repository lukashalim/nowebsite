import { BUY_FULL_LIST_STRIPE_URL } from "@/lib/directory/buy-full-list";

export function BuyFullListCta() {
  return (
    <a
      href={BUY_FULL_LIST_STRIPE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
    >
      Just want this list? Get the full export — $9
    </a>
  );
}
