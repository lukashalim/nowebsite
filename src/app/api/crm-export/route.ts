import { NextResponse } from "next/server";
import { buildCrmLeadsCsv, crmExportFilename } from "@/lib/crm-csv-export";
import { fetchCrmBusinessRows } from "@/lib/crm-cohort";
import { tryParseCrmSearchParams } from "@/lib/crm-params";
import { getSiteOrigin } from "@/lib/site-url";
import { getUserProfile, isPro } from "@/lib/subscription";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessLead } from "@/lib/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchAllCrmRows(
  userId: string,
  rawParams: Record<string, string | string[] | undefined>,
): Promise<{ rows: BusinessLead[]; error: string | null }> {
  const parsed = tryParseCrmSearchParams(rawParams);
  if (!parsed.ok) {
    return { rows: [], error: "Invalid export filters" };
  }

  const allRows: BusinessLead[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const result = await fetchCrmBusinessRows(
      { ...parsed.data, page, pageSize },
      userId,
    );

    if (result.error) {
      return { rows: [], error: result.error };
    }

    allRows.push(...result.rows);

    if (allRows.length >= result.total || result.rows.length === 0) {
      break;
    }

    page += 1;
  }

  return { rows: allRows, error: null };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const profile = await getUserProfile(user.id);
  const userIsPro = isPro(profile);

  const { searchParams } = new URL(request.url);
  const raw: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  if (!userIsPro && searchParams.get("all") === "1") {
    return NextResponse.json(
      { error: "Full CSV export requires Pro" },
      { status: 403 },
    );
  }

  const { rows, error } = userIsPro
    ? await fetchAllCrmRows(user.id, raw)
    : await (async () => {
        const parsed = tryParseCrmSearchParams(raw);
        if (!parsed.ok) {
          return { rows: [], error: "Invalid export filters" };
        }
        // Free tier: single page only (current filters + page/pageSize).
        const result = await fetchCrmBusinessRows(
          {
            ...parsed.data,
            page: parsed.data.page,
            pageSize: parsed.data.pageSize,
          },
          user.id,
        );
        if (result.error) {
          return { rows: [], error: result.error };
        }
        return { rows: result.rows, error: null };
      })();

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const csv = buildCrmLeadsCsv(rows, getSiteOrigin());
  const filename = crmExportFilename();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
