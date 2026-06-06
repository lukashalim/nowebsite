"use client";

import { useEffect, useState } from "react";
import { updateContactCount } from "@/app/actions/update-contact";
import {
  crmInlineCellClass,
  crmInlineSelectClass,
} from "@/components/crm-inline-field-styles";

const OPTIONS = Array.from({ length: 4 }, (_, i) => i);

interface ContactCountSelectProps {
  placeId: string;
  value: number;
  onValueChange?: (next: number) => void;
}

export function ContactCountSelect({
  placeId,
  value,
  onValueChange,
}: ContactCountSelectProps) {
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  return (
    <div className={crmInlineCellClass}>
      <select
        className={`${crmInlineSelectClass} min-w-[3rem] tabular-nums`}
        disabled={pending}
        value={selected}
        aria-label="Times contacted"
        onChange={async (e) => {
          const next = Number(e.target.value);
          const previous = selected;
          setSelected(next);
          setPending(true);
          const res = await updateContactCount(placeId, next);
          setPending(false);
          if (res.ok) {
            onValueChange?.(next);
          } else {
            setSelected(previous);
            window.alert(res.error);
          }
        }}
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
