"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildCrmQueryString,
  type CrmSearchParams,
} from "@/lib/crm-params";
import type { CrmCategoryFilterOption, CrmStateFilterOption } from "@/lib/crm-filter-options";
import {
  categoryAllowedForGroup,
  filterCrmCategoriesByGroup,
} from "@/lib/crm-filter-options";
import type { CategoryGroup, CategoryGroupId } from "@/lib/directory/category-group-ids";
import { CrmExportButton } from "@/components/crm-export-button";
import { CRM_BASE_PATH } from "@/lib/crm-path";

interface CrmFiltersProps {
  params: CrmSearchParams;
  groups: readonly CategoryGroup[];
  categories: CrmCategoryFilterOption[];
  states: CrmStateFilterOption[];
  isPro: boolean;
}

const fieldClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

const labelClass = "flex shrink-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400";

function categoryValidForGroup(
  category: string,
  categoryGroup: CategoryGroupId | "",
  categories: CrmCategoryFilterOption[],
): boolean {
  return categoryAllowedForGroup(
    category,
    categoryGroup || undefined,
    categories,
  );
}

export function CrmFilters({
  params,
  groups,
  categories,
  states,
  isPro,
}: CrmFiltersProps) {
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroupId | "">(
    params.categoryGroup ?? "",
  );
  const [category, setCategory] = useState(() => {
    const initial = params.category ?? "";
    if (
      initial &&
      !categoryValidForGroup(initial, params.categoryGroup ?? "", categories)
    ) {
      return "";
    }
    return initial;
  });

  const visibleCategories = useMemo(
    () => filterCrmCategoriesByGroup(categories, categoryGroup || undefined),
    [categories, categoryGroup],
  );

  function handleIndustryChange(next: CategoryGroupId | "") {
    setCategoryGroup(next);
    if (next && category) {
      const stillValid = categories.some(
        (c) => c.value === category && c.groupId === next,
      );
      if (!stillValid) {
        setCategory("");
      }
    }
  }

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <form
        method="get"
        className="flex flex-wrap items-end gap-x-3 gap-y-3"
      >
        <label className={labelClass}>
          Reviews
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              name="minReviews"
              min={0}
              defaultValue={params.minReviews}
              aria-label="Minimum reviews"
              className={`${fieldClass} w-[4.5rem]`}
            />
            <span className="text-zinc-400" aria-hidden>
              –
            </span>
            <input
              type="number"
              name="maxReviews"
              min={0}
              defaultValue={params.maxReviews}
              aria-label="Maximum reviews"
              className={`${fieldClass} w-[4.5rem]`}
            />
          </span>
        </label>

        <label className={labelClass}>
          Min rating
          <input
            type="number"
            name="minRating"
            min={0}
            max={5}
            step={0.1}
            defaultValue={params.minRating}
            className={`${fieldClass} w-[4.5rem]`}
          />
        </label>

        <label className={labelClass}>
          Web Presence
          <select
            name="webPresence"
            defaultValue={params.webPresence}
            className={`${fieldClass} min-w-[9rem]`}
            title="All = no standalone site (any FB/WA listing). Facebook / WhatsApp narrow by Maps listing. Yes = real website."
          >
            <option value="all">All</option>
            <option value="plain">No real site</option>
            <option value="facebook">Facebook</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        <label className={labelClass}>
          Phone type
          <select
            name="phoneLineType"
            defaultValue={params.phoneLineType}
            className={`${fieldClass} min-w-[9rem]`}
            title="Filter by Telnyx carrier lookup (home-services backfill). Not looked up = no stored type yet."
          >
            <option value="all">All</option>
            <option value="mobile">Mobile</option>
            <option value="landline_or_voip">Landline / VoIP</option>
            <option value="unknown">Unknown</option>
            <option value="not_checked">Not looked up</option>
          </select>
        </label>

        <label className={labelClass}>
          Stage
          <select
            name="stage"
            defaultValue={params.stage ?? ""}
            className={`${fieldClass} min-w-[8rem]`}
          >
            <option value="">All stages</option>
            <option value="new">New</option>
            <option value="replied">Replied</option>
            <option value="demo_sent">Demo Sent</option>
            <option value="interested">Interested</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className={labelClass}>
          Industry
          <select
            name="categoryGroup"
            value={categoryGroup}
            onChange={(e) =>
              handleIndustryChange(e.target.value as CategoryGroupId | "")
            }
            className={`${fieldClass} min-w-[10rem]`}
          >
            <option value="">All industries</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Category
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${fieldClass} min-w-[10rem]`}
            disabled={categoryGroup !== "" && visibleCategories.length === 0}
          >
            <option value="">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          State
          <select
            name="state"
            defaultValue={params.state ?? ""}
            className={`${fieldClass} min-w-[8rem]`}
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Times Contacted
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              name="contactMin"
              min={0}
              max={3}
              defaultValue={params.contactMin ?? ""}
              placeholder="—"
              aria-label="Minimum times contacted"
              className={`${fieldClass} w-[3.25rem]`}
            />
            <span className="text-zinc-400" aria-hidden>
              –
            </span>
            <input
              type="number"
              name="contactMax"
              min={0}
              max={3}
              defaultValue={params.contactMax ?? ""}
              placeholder="—"
              aria-label="Maximum times contacted"
              className={`${fieldClass} w-[3.25rem]`}
            />
          </span>
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CrmExportButton params={params} isPro={isPro} />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Apply filters
          </button>
          <Link
            href={CRM_BASE_PATH}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reset defaults
          </Link>
        </div>
      </form>
    </section>
  );
}

interface CrmPaginationProps {
  params: CrmSearchParams;
  total: number;
}

export function CrmPagination({ params, total }: CrmPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const base = (pageNum: number): string => {
    const q: CrmSearchParams = { ...params, page: pageNum };
    const qs = buildCrmQueryString(q);
    return qs ? `${CRM_BASE_PATH}${qs}` : CRM_BASE_PATH;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      <p>
        Page {page} of {totalPages}
        <span className="mx-2 text-zinc-400">·</span>
        {total.toLocaleString()} matching
        <span className="mx-2 text-zinc-400">·</span>
        {params.pageSize} per page
      </p>
      <div className="flex gap-2">
        {prevPage ? (
          <Link
            href={base(prevPage)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-3 py-1.5 text-zinc-400">
            Previous
          </span>
        )}
        {nextPage ? (
          <Link
            href={base(nextPage)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-3 py-1.5 text-zinc-400">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
