"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOwnerName } from "@/app/actions/update-owner-name";
import {
  crmInlineCellClass,
  crmInlineInputClass,
} from "@/components/crm-inline-field-styles";

interface OwnerNameInputProps {
  placeId: string;
  value: string | null;
}

export function OwnerNameInput({ placeId, value }: OwnerNameInputProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className={crmInlineCellClass}>
      <input
        type="text"
        maxLength={100}
        disabled={pending}
        value={draft}
        placeholder="—"
        aria-label="Owner name"
        className={`${crmInlineInputClass} min-w-[7rem] placeholder:text-zinc-400`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          const trimmed = draft.trim();
          const previous = (value ?? "").trim();
          if (trimmed === previous) return;

          setPending(true);
          const res = await updateOwnerName(placeId, trimmed || null);
          setPending(false);
          if (res.ok) {
            router.refresh();
          } else {
            setDraft(value ?? "");
            window.alert(res.error);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
