import type { Metadata } from "next";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { SpintaxTemplateEditor } from "@/components/spintax-template-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Spintax templates | Mini CRM",
    description: "Edit saved DM spintax templates for CRM outreach.",
  };
}

export default async function CrmSpintaxPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

  const result = await listSpintaxTemplates();

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[1100px]">
      <header className="space-y-2">
        <CrmNav active="spintax" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          DM Spintax Templates
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Edit outreach templates by lead type: Facebook listing vs no Facebook.
          Use {"{a|b|c}"} for variations and [Name] / [category] for lead tokens.
        </p>
      </header>

      {!result.ok ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {result.error}
        </div>
      ) : (
        <SpintaxTemplateEditor initialTemplates={result.templates} />
      )}
    </div>
  );
}
