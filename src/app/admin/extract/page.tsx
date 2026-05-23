import { notFound, redirect } from "next/navigation";
import { isLocalAdminEnabled } from "@/lib/local-admin";

/** @deprecated Use /admin/scrape */
export default function AdminExtractRedirectPage() {
  if (!isLocalAdminEnabled()) {
    notFound();
  }
  redirect("/admin/scrape");
}
