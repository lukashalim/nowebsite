import type { Metadata } from "next";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { TwilioSettingsForm } from "@/components/twilio-settings-form";
import { suggestUsernameFromEmail } from "@/lib/profile-username";
import { ensureSendFoxProfileForUser } from "@/lib/sendfox-profile-sync";
import { getTwilioProfilePublic, getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Settings | Outreach Engine",
    description:
      "Configure demo site settings and optional Pro communications via your Twilio account.",
  };
}

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

  const params = await searchParams;
  const showUsernameSetupBanner = params.setup === "username";
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
  const twilioProfile = await getTwilioProfilePublic(user.id);
  const userIsPro = isPro(profile);
  const suggestedUsername =
    profile?.username?.trim() ||
    (user.email ? suggestUsernameFromEmail(user.email) : "");

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:max-w-2xl sm:p-6">
      <header className="space-y-2">
        <CrmNav active="settings" isPro={userIsPro} />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Configure your demo site and optional Pro communications. Save Twilio
          credentials to send SMS and place calls from your business line in the CRM.
        </p>
      </header>

      {showUsernameSetupBanner ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Choose a public username for your demo links.
        </p>
      ) : null}

      <ProfileSettingsForm
        initialUsername={suggestedUsername}
        initialPaymentLink={profile?.user_payment_link ?? ""}
      />

      <TwilioSettingsForm initialTwilio={twilioProfile} />
    </div>
  );
}
