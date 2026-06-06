"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setLeadInvalid } from "@/app/actions/update-is-invalid";

interface MarkInvalidButtonProps {
  placeId: string;
}

export function MarkInvalidButton({ placeId }: MarkInvalidButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
      onClick={async () => {
        const confirmed = window.confirm(
          "Mark this listing as invalid? It will be hidden from the CRM list.",
        );
        if (!confirmed) return;

        setPending(true);
        const res = await setLeadInvalid(placeId, true);
        setPending(false);
        if (res.ok) {
          router.refresh();
        } else {
          window.alert(res.error);
        }
      }}
    >
      Mark invalid
    </button>
  );
}
