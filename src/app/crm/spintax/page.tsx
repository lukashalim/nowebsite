import type { Metadata } from "next";
import Link from "next/link";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { CrmLogin } from "@/components/crm-login";
import { SpintaxTemplateEditor } from "@/components/spintax-template-editor";
import { CRM_BASE_PATH } from "@/lib/crm-path";
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
      <header className="space-y-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href={CRM_BASE_PATH}
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            CRM →
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Spintax templates
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Edit your saved outreach templates. Use {"{a|b|c}"} for variations and
          [Name] / [category] for lead-specific tokens.
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
