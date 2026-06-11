"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { suggestOwnerNameFromReviews } from "@/app/actions/suggest-owner-name";
import { updateOwnerName } from "@/app/actions/update-owner-name";
import {
  crmInlineCellClass,
  crmInlineInputClass,
} from "@/components/crm-inline-field-styles";

const suggestButtonClass =
  "shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

interface OwnerNameInputProps {
  placeId: string;
  value: string | null;
}

export function OwnerNameInput({ placeId, value }: OwnerNameInputProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [draft, setDraft] = useState(value ?? "");

  async function handleSuggest() {
    setHint(null);
    setSuggesting(true);
    const res = await suggestOwnerNameFromReviews(placeId);
    setSuggesting(false);

    if (!res.ok) {
      window.alert(res.error);
      return;
    }

    if (res.ownerName) {
      setDraft(res.ownerName);
      setHint(null);
    } else {
      setHint("No clear owner name in reviews.");
    }
  }

  return (
    <div className={crmInlineCellClass}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          maxLength={100}
          disabled={pending || suggesting}
          value={draft}
          placeholder="—"
          aria-label="Owner name"
          className={`${crmInlineInputClass} min-w-[7rem] flex-1 placeholder:text-zinc-400`}
          onChange={(e) => {
            setDraft(e.target.value);
            if (hint) setHint(null);
          }}
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
        <button
          type="button"
          disabled={pending || suggesting}
          className={suggestButtonClass}
          onClick={handleSuggest}
        >
          {suggesting ? "…" : "Suggest"}
        </button>
      </div>
      {hint ? (
        <p className="mt-0.5 px-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
