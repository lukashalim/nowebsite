import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExtractAdminPanel } from "@/components/extract-admin-panel";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const metadata: Metadata = {
  title: "Local ingest — NDJSON cache",
  robots: { index: false, follow: false },
};

export default async function AdminScrapePage() {
  const host = (await headers()).get("host");
  if (!isLocalAdminEnabled(host)) {
    notFound();
  }

  return <ExtractAdminPanel />;
}
