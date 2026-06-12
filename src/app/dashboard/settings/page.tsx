import type { Metadata } from "next";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Demo site settings | Outreach Engine",
    description:
      "Configure your public demo username and Stripe payment link for tenant preview sites.",
  };
}

export default async function DashboardSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

  const profile = await getUserProfile(user.id);
  const userIsPro = isPro(profile);

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:max-w-2xl sm:p-6">
      <header className="space-y-2">
        <CrmNav isPro={userIsPro} />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Demo site settings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Set the username for your public demo URLs and the Stripe checkout link
          shown on preview pages when a lead clicks activate.
        </p>
      </header>

      <ProfileSettingsForm
        initialUsername={profile?.username ?? ""}
        initialPaymentLink={profile?.user_payment_link ?? ""}
      />
    </div>
  );
}
