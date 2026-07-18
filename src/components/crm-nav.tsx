import Link from "next/link";
import { headers } from "next/headers";
import { signOutFromCrm } from "@/app/actions/auth";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import { UpgradeToProButton } from "@/components/upgrade-to-pro-button";
import { shouldShowLocalDevTools } from "@/lib/dev-host";
import { CRM_BASE_PATH } from "@/lib/crm-path";

interface CrmNavProps {
  active?: "leads" | "spintax" | "postcards" | "settings";
  isPro?: boolean;
}

const breadcrumbLinkClass =
  "text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

const breadcrumbActiveClass =
  "font-medium text-zinc-800 dark:text-zinc-200";

function BreadcrumbSeparator() {
  return (
    <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
      /
    </span>
  );
}

export async function CrmNav({ active, isPro = false }: CrmNavProps) {
  const host = (await headers()).get("host") ?? "";
  const showScrapeQueue = shouldShowLocalDevTools(host);

  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal text-zinc-600 dark:text-zinc-400"
      aria-label="Breadcrumb"
    >
      <Link href="/" className={breadcrumbLinkClass}>
        Home
      </Link>
      <BreadcrumbSeparator />
      {active === "leads" ? (
        <span className={breadcrumbActiveClass} aria-current="page">
          Leads
        </span>
      ) : (
        <Link href={CRM_BASE_PATH} className={breadcrumbLinkClass}>
          Leads
        </Link>
      )}
      <BreadcrumbSeparator />
      {active === "spintax" ? (
        <span className={breadcrumbActiveClass} aria-current="page">
          DM Spintax Templates
        </span>
      ) : (
        <Link
          href={`${CRM_BASE_PATH}/spintax`}
          className={breadcrumbLinkClass}
        >
          DM Spintax Templates
        </Link>
      )}
      <BreadcrumbSeparator />
      {active === "postcards" ? (
        <span className={breadcrumbActiveClass} aria-current="page">
          Postcards
        </span>
      ) : (
        <Link
          href={`${CRM_BASE_PATH}/postcards`}
          className={breadcrumbLinkClass}
        >
          Postcards
        </Link>
      )}
      <BreadcrumbSeparator />
      {active === "settings" ? (
        <span className={breadcrumbActiveClass} aria-current="page">
          Settings
        </span>
      ) : (
        <Link href="/dashboard/settings" className={breadcrumbLinkClass}>
          Settings
        </Link>
      )}
      {showScrapeQueue ? (
        <>
          <BreadcrumbSeparator />
          <Link href="/scrape-progress" className={breadcrumbLinkClass}>
            Scrape queue
          </Link>
        </>
      ) : null}
      {!isPro ? (
        <>
          <BreadcrumbSeparator />
          <UpgradeToProButton
            className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            label="Upgrade to Pro"
          />
        </>
      ) : (
        <>
          <BreadcrumbSeparator />
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Pro
          </span>
          <BreadcrumbSeparator />
          <ManageSubscriptionButton
            className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            label="Manage subscription"
          />
        </>
      )}
      <BreadcrumbSeparator />
      <form action={signOutFromCrm} className="inline">
        <button
          type="submit"
          className={`${breadcrumbLinkClass} cursor-pointer bg-transparent p-0`}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
