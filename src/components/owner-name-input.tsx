"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOwnerName } from "@/app/actions/update-owner-name";

interface OwnerNameInputProps {
  placeId: string;
  value: string | null;
}

export function OwnerNameInput({ placeId, value }: OwnerNameInputProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <input
      type="text"
      maxLength={100}
      disabled={pending}
      value={draft}
      placeholder="Owner name"
      aria-label="Owner name"
      className="w-full min-w-[7rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
  );
}
