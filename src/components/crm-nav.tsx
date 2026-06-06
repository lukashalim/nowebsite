import Link from "next/link";
import { headers } from "next/headers";
import { signOutFromCrm } from "@/app/actions/auth";
import { shouldShowLocalDevTools } from "@/lib/dev-host";
import { CRM_BASE_PATH } from "@/lib/crm-path";

interface CrmNavProps {
  active?: "leads" | "spintax";
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

export async function CrmNav({ active }: CrmNavProps) {
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
      {active === "spintax" ? (
        <Link href={CRM_BASE_PATH} className={breadcrumbLinkClass}>
          Leads
        </Link>
      ) : (
        <span className={breadcrumbActiveClass} aria-current="page">
          Leads
        </span>
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
      {showScrapeQueue ? (
        <>
          <BreadcrumbSeparator />
          <Link href="/scrape-progress" className={breadcrumbLinkClass}>
            Scrape queue
          </Link>
        </>
      ) : null}
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
