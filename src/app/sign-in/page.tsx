import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrmLogin } from "@/components/crm-login";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to No Website Business Leads — the prospecting tool for web designers.",
};

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(CRM_BASE_PATH);
  }

  return <CrmLogin />;
}
