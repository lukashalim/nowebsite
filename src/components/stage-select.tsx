"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateLeadStage } from "@/app/actions/update-stage";
import {
  crmInlineCellClass,
  crmInlineSelectClass,
} from "@/components/crm-inline-field-styles";
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
    <div className={crmInlineCellClass}>
      <select
        className={`${crmInlineSelectClass} min-w-[7.5rem]`}
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
    </div>
  );
}
