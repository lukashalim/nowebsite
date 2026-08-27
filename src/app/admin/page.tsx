import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  await requireAdminPage();
  redirect("/admin/purchases");
}
