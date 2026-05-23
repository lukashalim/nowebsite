import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtractAdminPanel } from "@/components/extract-admin-panel";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const metadata: Metadata = {
  title: "Local NDJSON scrape → Supabase",
  robots: { index: false, follow: false },
};

export default function AdminScrapePage() {
  if (!isLocalAdminEnabled()) {
    notFound();
  }

  return <ExtractAdminPanel />;
}
