import Link from "next/link";
import {
  buildCrmQueryString,
  type CrmSearchParams,
} from "@/lib/crm-params";
import { CRM_BASE_PATH } from "@/lib/crm-path";

interface CrmShowTestLeadsToggleProps {
  params: CrmSearchParams;
}

export function CrmShowTestLeadsToggle({ params }: CrmShowTestLeadsToggleProps) {
  const checked = params.showTestLeads;
  const qs = buildCrmQueryString({
    ...params,
    showTestLeads: !checked,
    page: 1,
  });
  const href = qs ? `${CRM_BASE_PATH}${qs}` : CRM_BASE_PATH;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        aria-pressed={checked}
        title={
          checked
            ? "Return to real outreach leads"
            : "Show only internal QA/test leads"
        }
      >
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
            checked
              ? "border-amber-600 bg-amber-500 text-white"
              : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
          }`}
          aria-hidden
        >
          {checked ? (
            <svg viewBox="0 0 12 12" className="size-3" fill="none">
              <path
                d="M2.5 6.5L5 9l4.5-5.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
        Show test leads
      </Link>
      {checked ? (
        <p
          className="text-xs font-medium text-amber-800 dark:text-amber-300"
          role="status"
        >
          Test-only view — QA data only, not live outreach leads.
        </p>
      ) : null}
    </div>
  );
}
