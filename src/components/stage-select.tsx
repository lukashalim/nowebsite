"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateLeadStage } from "@/app/actions/update-stage";
import {
  CRM_STAGE_LABELS,
  CRM_STAGE_VALUES,
  type CrmStage,
} from "@/lib/crm-stage";

interface StageSelectProps {
  placeId: string;
  value: CrmStage;
}

export function StageSelect({ placeId, value }: StageSelectProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState(value);

  return (
    <select
      className="w-full min-w-[7.5rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      disabled={pending}
      value={selected}
      aria-label="Pipeline stage"
      onChange={async (e) => {
        const next = e.target.value as CrmStage;
        const previous = selected;
        setSelected(next);
        setPending(true);
        const res = await updateLeadStage(placeId, next);
        setPending(false);
        if (res.ok) {
          router.refresh();
        } else {
          setSelected(previous);
          window.alert(res.error);
        }
      }}
    >
      {CRM_STAGE_VALUES.map((stage) => (
        <option key={stage} value={stage}>
          {CRM_STAGE_LABELS[stage]}
        </option>
      ))}
    </select>
  );
}
