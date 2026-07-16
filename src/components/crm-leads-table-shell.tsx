import { CrmLeadsTableBody } from "@/components/crm-leads-table-body";
import { CrmPagination } from "@/components/crm-filters";
import type { CrmOutreachRecordedHandler } from "@/components/crm-free-usage-layout";
import type { BusinessLead } from "@/lib/business";
import type { CrmSearchParams } from "@/lib/crm-params";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface CrmLeadsTableShellProps {
  rows: BusinessLead[];
  userId: string;
  params: CrmSearchParams;
  total: number;
  spintaxTemplates: SpintaxTemplate[];
  isPro: boolean;
  initialOutreachRemaining: number | null;
  senderName?: string | null;
  onOutreachRecorded?: CrmOutreachRecordedHandler;
}

export function CrmLeadsTableShell({
  rows,
  userId,
  params,
  total,
  spintaxTemplates,
  isPro,
  initialOutreachRemaining,
  senderName,
  onOutreachRecorded,
}: CrmLeadsTableShellProps) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-3 py-3">Business</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3">Rating</th>
              <th className="px-3 py-3">Reviews</th>
              <th className="px-3 py-3">Outreach</th>
              <th className="px-3 py-3">DM Spintax</th>
              <th className="px-3 py-3">Demo</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3">Owner</th>
              <th className="px-3 py-3">Notes</th>
              <th className="px-3 py-3">Bad Lead</th>
              <th className="px-3 py-3">Contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <CrmLeadsTableBody
              rows={rows}
              userId={userId}
              webPresence={params.webPresence}
              spintaxTemplates={spintaxTemplates}
              isPro={isPro}
              initialOutreachRemaining={initialOutreachRemaining}
              senderName={senderName}
              onOutreachRecorded={onOutreachRecorded}
            />
          </tbody>
        </table>
      </div>

      <CrmPagination params={params} total={total} />
    </>
  );
}
