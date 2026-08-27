import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { ExtractAdminPanel } from "@/components/extract-admin-panel";
import { requireAdminPage } from "@/lib/admin/require-admin-page";

export const metadata: Metadata = {
  title: "Local ingest — NDJSON cache",
  robots: { index: false, follow: false },
};

export default async function AdminScrapePage() {
  await requireAdminPage();

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <AdminNav current="scrape" />
      </div>
      <ExtractAdminPanel />
    </>
  );
}
