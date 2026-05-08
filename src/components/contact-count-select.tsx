"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateContactCount } from "@/app/actions/update-contact";

const OPTIONS = Array.from({ length: 4 }, (_, i) => i);

interface ContactCountSelectProps {
  placeId: string;
  value: number;
}

export function ContactCountSelect({
  placeId,
  value,
}: ContactCountSelectProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState(value);

  return (
    <select
      className="w-full min-w-[4.5rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
          router.refresh();
        } else {
          setSelected(previous);
          window.alert(res.error);
        }
      }}
    >
      <option value={-1}>dead</option>
      {OPTIONS.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
