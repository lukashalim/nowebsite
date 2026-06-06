"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
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
      title="Mark as bad lead"
      aria-label="Mark as bad lead"
      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      onClick={async () => {
        const confirmed = window.confirm(
          "Mark this listing as a bad lead? It will be hidden from the CRM list.",
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
      <X className="size-4" aria-hidden />
    </button>
  );
}
