import Link from "next/link";
import {
  buildCrmQueryString,
  type CrmOutreachMode,
  type CrmPostcardMode,
  type CrmPostcardStatus,
  type CrmSearchParams,
} from "@/lib/crm-params";
import { CRM_BASE_PATH } from "@/lib/crm-path";

const MODES: { id: CrmOutreachMode; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "No outreach surface filter" },
  { id: "call", label: "Call", hint: "Leads with a phone number" },
  { id: "text", label: "Text", hint: "Leads with a phone number" },
  { id: "mail", label: "Mail", hint: "Leads with a full mailing address" },
];

const POSTCARD_MODES: { id: CrmPostcardMode; label: string }[] = [
  { id: "test", label: "Test" },
  { id: "production", label: "Production" },
];

const POSTCARD_STATUSES: { id: CrmPostcardStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "scanned", label: "Scanned" },
  { id: "not_scanned", label: "Not Scanned" },
  { id: "not_sent", label: "Not Sent" },
];

interface CrmOutreachModeToggleProps {
  params: CrmSearchParams;
}

function crmHref(params: CrmSearchParams): string {
  const qs = buildCrmQueryString(params);
  return qs ? `${CRM_BASE_PATH}${qs}` : CRM_BASE_PATH;
}

const tabActive =
  "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50";
const tabIdle =
  "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

export function CrmOutreachModeToggle({ params }: CrmOutreachModeToggleProps) {
  const active = params.outreachMode;

  function hrefForMode(mode: CrmOutreachMode): string {
    if (mode === "mail") {
      return crmHref({
        ...params,
        outreachMode: "mail",
        page: 1,
      });
    }
    return crmHref({
      ...params,
      outreachMode: mode,
      postcardMode: "production",
      postcardStatus: "all",
      page: 1,
    });
  }

  function hrefForPostcardMode(mode: CrmPostcardMode): string {
    return crmHref({
      ...params,
      outreachMode: "mail",
      postcardMode: mode,
      page: 1,
    });
  }

  function hrefForPostcardStatus(status: CrmPostcardStatus): string {
    return crmHref({
      ...params,
      outreachMode: "mail",
      postcardStatus: status,
      page: 1,
    });
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
                href={hrefForMode(mode.id)}
                role="tab"
                aria-selected={selected}
                className={`rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
                  selected ? tabActive : tabIdle
                }`}
              >
                {mode.label}
              </Link>
            );
          })}
        </div>
      </div>

      {active === "mail" ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Postcard mode
            </p>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900 sm:w-56"
              role="tablist"
              aria-label="Filter by Lob test or production"
            >
              {POSTCARD_MODES.map((mode) => {
                const selected = params.postcardMode === mode.id;
                return (
                  <Link
                    key={mode.id}
                    href={hrefForPostcardMode(mode.id)}
                    role="tab"
                    aria-selected={selected}
                    className={`rounded-md px-3 py-1.5 text-center text-sm font-semibold transition ${
                      selected ? tabActive : tabIdle
                    }`}
                  >
                    {mode.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Status
            </p>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900 sm:grid-cols-5"
              role="tablist"
              aria-label="Filter by postcard send and scan status"
            >
              {POSTCARD_STATUSES.map((status) => {
                const selected = params.postcardStatus === status.id;
                return (
                  <Link
                    key={status.id}
                    href={hrefForPostcardStatus(status.id)}
                    role="tab"
                    aria-selected={selected}
                    className={`rounded-md px-2 py-1.5 text-center text-sm font-semibold transition ${
                      selected ? tabActive : tabIdle
                    }`}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
