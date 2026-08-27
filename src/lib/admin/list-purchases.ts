import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  listPurchaseScopeLabel,
  type ListPurchaseRow,
} from "@/lib/directory/list-purchase";
import { DEFAULT_DIRECTORY_LISTING_FILTERS } from "@/lib/directory/listing-filters";

const ROW_CAP = 200;

export interface AdminListPurchaseRow {
  stripeSessionId: string;
  createdAt: string;
  fulfilledAt: string | null;
  buyerEmail: string | null;
  scopeLabel: string;
  filename: string | null;
  remainingRows: number;
  amountCents: number | null;
  currency: string | null;
  emailStatus: ListPurchaseRow["email_status"];
  emailSentAt: string | null;
  emailError: string | null;
  status: ListPurchaseRow["status"];
  errorMessage: string | null;
}

function filenameFromStoragePath(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function scopeLabelForRow(row: ListPurchaseRow): string {
  if (row.scope_kind === "category" || row.scope_kind === "city") {
    return listPurchaseScopeLabel(
      { kind: row.scope_kind, slug: row.scope_slug },
      { ...DEFAULT_DIRECTORY_LISTING_FILTERS, ...row.filters },
    );
  }
  return row.scope_slug;
}

export async function fetchAdminListPurchases(): Promise<{
  rows: AdminListPurchaseRow[];
  error: string | null;
}> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("list_purchases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows: AdminListPurchaseRow[] = ((data ?? []) as ListPurchaseRow[]).map(
    (row) => ({
      stripeSessionId: row.stripe_session_id,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at,
      buyerEmail: row.buyer_email,
      scopeLabel: scopeLabelForRow(row),
      filename: filenameFromStoragePath(row.storage_path),
      remainingRows: Math.max(0, row.total_rows - row.free_rows_given),
      amountCents: row.amount_cents,
      currency: row.currency,
      emailStatus: row.email_status,
      emailSentAt: row.email_sent_at,
      emailError: row.email_error,
      status: row.status,
      errorMessage: row.error_message,
    }),
  );

  return { rows, error: null };
}
