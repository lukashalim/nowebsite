import type { Metadata } from "next";
import Link from "next/link";
import { listSpintaxTemplates } from "@/app/actions/spintax-templates";
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { CrmFilters } from "@/components/crm-filters";
import { CrmFreeUsageLayout } from "@/components/crm-free-usage-layout";
import { CrmLeadsTableShell } from "@/components/crm-leads-table-shell";
import { CrmLoadError } from "@/components/crm-load-error";
import { CrmLogin } from "@/components/crm-login";
import { CrmNav } from "@/components/crm-nav";
import { CrmOutreachModeToggle } from "@/components/crm-outreach-mode-toggle";
import { CrmShowTestLeadsToggle } from "@/components/crm-show-test-leads-toggle";
import { fetchCrmBusinessRows, fetchCrmFilterOptions } from "@/lib/crm-cohort";
import { fetchCategoryGroupTaxonomy } from "@/lib/directory/category-groups";
import { getCrmUsageSummary } from "@/lib/crm-usage";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { tryParseCrmSearchParams } from "@/lib/crm-params";
import { getUserPostcardLifetimeSlots } from "@/lib/postcard/limits";
import {
  ensureUserProSynced,
  getLobProfilePublic,
  getUserProfile,
  isPro,
} from "@/lib/subscription";
import { ensureSendFoxProfileForUser } from "@/lib/sendfox-profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "No-website leads | Outreach Engine",
    description:
      "No-website leads with extracted review excerpts. Filter by reviews, rating, and outreach.",
  };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CrmLogin />;
  }

  const raw = await searchParams;
  const parsed = tryParseCrmSearchParams(raw);

  if (!parsed.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Invalid filters
        </h1>
        <ul className="mt-2 list-inside list-disc text-sm text-red-600">
          {parsed.issues.map((issue) => (
            <li key={`${issue.path.join(".")}-${issue.message}`}>
              {issue.path.length ? `${issue.path.join(".")}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
        <Link
          href={CRM_BASE_PATH}
          className="mt-4 inline-block text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          Reset to defaults
        </Link>
      </div>
    );
  }

  const p = parsed.data;
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
  const checkoutSuccess = raw.checkout === "success";
  const checkoutSessionId =
    typeof raw.session_id === "string" ? raw.session_id.trim() : undefined;

  profile = await ensureUserProSynced(user.id, {
    checkoutSessionId:
      checkoutSuccess && checkoutSessionId ? checkoutSessionId : undefined,
    searchRecentCheckout: checkoutSuccess,
  });

  const userIsPro = isPro(profile);
  const usageSummary = userIsPro ? null : await getCrmUsageSummary(user.id);
  const outreachLimitReached =
    raw.limit === "outreach" ||
    (!userIsPro && usageSummary !== null && usageSummary.remaining === 0);

  const [lobProfile, postcardSlots] = await Promise.all([
    getLobProfilePublic(user.id),
    getUserPostcardLifetimeSlots(user.id, { isPro: userIsPro }),
  ]);
  const postcardMail = {
    hasLobTestApiKey: lobProfile.has_lob_test_api_key,
    hasLobLiveApiKey: lobProfile.has_lob_live_api_key,
    hasReturnAddress: lobProfile.has_return_address,
    lifetimeUnlimited: userIsPro,
    testRemaining: postcardSlots.testRemaining,
    liveRemaining: postcardSlots.liveRemaining,
  };

  const [{ rows, total, error: loadErr }, spintaxResult, filterOptions, taxonomy] =
    await Promise.all([
      fetchCrmBusinessRows(p, user.id),
      listSpintaxTemplates(),
      fetchCrmFilterOptions(),
      fetchCategoryGroupTaxonomy(),
    ]);
  const loadError = loadErr;
  const spintaxTemplates = spintaxResult.ok ? spintaxResult.templates : [];

  const filters = (
    <div className="flex flex-col gap-3">
      <CrmOutreachModeToggle params={p} />
      <CrmShowTestLeadsToggle params={p} />
      <CrmFilters
        params={p}
        groups={taxonomy.groups}
        categories={filterOptions.categories}
        states={filterOptions.states}
        isPro={userIsPro}
      />
    </div>
  );

  const tableShell = loadError ? (
    <CrmLoadError message={loadError} />
  ) : (
    <CrmLeadsTableShell
      rows={rows}
      userId={user.id}
      params={p}
      total={total}
      spintaxTemplates={spintaxTemplates}
      isPro={userIsPro}
      initialOutreachRemaining={usageSummary?.remaining ?? null}
      postcardMail={postcardMail}
      senderName={profile?.email?.split("@")[0]?.trim() || null}
    />
  );

  return (
    <div className="mx-auto flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:max-w-[1400px]">
      <header className="space-y-2">
        <CrmNav active="leads" isPro={userIsPro} />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          No-website leads
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Browse verified local businesses without websites. Use Outreach mode
          (Call, Text, or Mail) to show only leads you can reach that way.
        </p>
      </header>

      <CheckoutSuccessBanner show={checkoutSuccess} isPro={userIsPro} />

      {usageSummary ? (
        <CrmFreeUsageLayout
          initialUsage={usageSummary}
          limitReached={outreachLimitReached}
        >
          {filters}
          {tableShell}
        </CrmFreeUsageLayout>
      ) : (
        <>
          {filters}
          {tableShell}
        </>
      )}
    </div>
  );
}
