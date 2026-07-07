import type { Metadata } from "next";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { CrmUsageBanner } from "@/components/crm-usage-banner";
import { SpintaxTemplateEditor } from "@/components/spintax-template-editor";
import { ensureSendFoxProfileForUser } from "@/lib/sendfox-profile-sync";
import { getCrmUsageSummary } from "@/lib/crm-usage";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Spintax templates | Outreach Engine",
    description:
      "Edit saved Facebook DM, SMS, call script, and email spintax templates for CRM outreach.",
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

  let profile = await getUserProfile(user.id);
  if (profile?.email) {
    const synced = await ensureSendFoxProfileForUser(
      user.id,
      profile.email,
      profile,
    );
    if (synced) {
      profile = await getUserProfile(user.id);
    }
  }
  const userIsPro = isPro(profile);
  const usageSummary = userIsPro ? null : await getCrmUsageSummary(user.id);
  const result = await listSpintaxTemplates();

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[1100px]">
      <header className="space-y-2">
        <CrmNav active="spintax" isPro={userIsPro} />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Spintax Templates
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Edit Facebook DM, SMS, call script, and email outreach templates by lead
          type. Use {"{a|b|c}"} for variations and [Name] / [category] for lead
          tokens.
        </p>
      </header>

      {usageSummary ? <CrmUsageBanner usage={usageSummary} /> : null}

      {!result.ok ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {result.error}
        </div>
      ) : (
        <SpintaxTemplateEditor
          initialTemplates={result.templates}
          senderPreviewName={
            profile?.email?.split("@")[0]?.trim() || null
          }
        />
      )}
    </div>
  );
}
