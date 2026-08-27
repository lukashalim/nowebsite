import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { fetchAdminListPurchases } from "@/lib/admin/list-purchases";
import { requireAdminPage } from "@/lib/admin/require-admin-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "List purchases",
  robots: { index: false, follow: false },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(
  amountCents: number | null,
  currency: string | null,
): string {
  if (amountCents == null) return "—";
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}

function emailLabel(status: string | null): string {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "—";
}

export default async function AdminPurchasesPage() {
  await requireAdminPage();
  const { rows, error } = await fetchAdminListPurchases();

  const collectedCents = rows.reduce(
    (sum, row) => sum + (row.amountCents ?? 0),
    0,
  );
  const fulfilledCount = rows.filter((row) => row.status === "fulfilled").length;
  const emailedCount = rows.filter((row) => row.emailStatus === "sent").length;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            List purchases
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            $9 full-list CSV checkouts: file stored, email backup, and amount
            collected. Newest 200.
          </p>
        </div>
        <AdminNav current="purchases" />
      </div>

      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {`${rows.length.toLocaleString()} purchase${rows.length === 1 ? "" : "s"}`}
        {" · "}
        {fulfilledCount.toLocaleString()} fulfilled
        {" · "}
        {emailedCount.toLocaleString()} emailed
        {" · "}
        {formatMoney(collectedCents, "usd")} collected
      </p>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">Buyer</th>
              <th className="px-3 py-2.5 font-medium">List</th>
              <th className="px-3 py-2.5 font-medium">File</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Fulfillment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No list purchases yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.stripeSessionId} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2.5 align-top text-zinc-700 dark:text-zinc-300">
                    <p>{formatWhen(row.createdAt)}</p>
                    {row.fulfilledAt ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Fulfilled {formatWhen(row.fulfilledAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {row.buyerEmail ? (
                      <a
                        href={`mailto:${row.buyerEmail}`}
                        className="text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
                      >
                        {row.buyerEmail}
                      </a>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top font-medium text-zinc-900 dark:text-zinc-100">
                    {row.scopeLabel}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {row.filename ? (
                      <>
                        <p className="break-all text-zinc-800 dark:text-zinc-200">
                          {row.filename}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {row.remainingRows.toLocaleString()} records
                        </p>
                      </>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top tabular-nums text-zinc-800 dark:text-zinc-200">
                    {formatMoney(row.amountCents, row.currency)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p
                      className={
                        row.emailStatus === "failed"
                          ? "text-red-700 dark:text-red-400"
                          : row.emailStatus === "skipped"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {emailLabel(row.emailStatus)}
                    </p>
                    {row.emailSentAt ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatWhen(row.emailSentAt)}
                      </p>
                    ) : null}
                    {row.emailError ? (
                      <p className="max-w-xs text-xs text-red-700 dark:text-red-400">
                        {row.emailError}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p
                      className={
                        row.status === "failed"
                          ? "text-red-700 dark:text-red-400"
                          : row.status === "pending"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {row.status}
                    </p>
                    {row.errorMessage ? (
                      <p className="max-w-xs text-xs text-red-700 dark:text-red-400">
                        {row.errorMessage}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
