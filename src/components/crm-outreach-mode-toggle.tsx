import Link from "next/link";
import {
  buildCrmQueryString,
  type CrmOutreachMode,
  type CrmSearchParams,
} from "@/lib/crm-params";
import { CRM_BASE_PATH } from "@/lib/crm-path";

const MODES: { id: CrmOutreachMode; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "No outreach surface filter" },
  { id: "call", label: "Call", hint: "Leads with a phone number" },
  { id: "text", label: "Text", hint: "Leads with a phone number" },
  { id: "mail", label: "Mail", hint: "Leads with a full mailing address" },
];

interface CrmOutreachModeToggleProps {
  params: CrmSearchParams;
}

export function CrmOutreachModeToggle({ params }: CrmOutreachModeToggleProps) {
  const active = params.outreachMode;

  function hrefFor(mode: CrmOutreachMode): string {
    const qs = buildCrmQueryString({ ...params, outreachMode: mode, page: 1 });
    return qs ? `${CRM_BASE_PATH}${qs}` : CRM_BASE_PATH;
  }

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Outreach mode"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Outreach mode
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {MODES.find((m) => m.id === active)?.hint ??
              "Filter leads by how you can reach them"}
          </p>
        </div>
        <div
          className="grid grid-cols-4 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
          role="tablist"
          aria-label="Filter by outreach channel"
        >
          {MODES.map((mode) => {
            const selected = active === mode.id;
            return (
              <Link
                key={mode.id}
                href={hrefFor(mode.id)}
                role="tab"
                aria-selected={selected}
                className={`rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
                  selected
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {mode.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
