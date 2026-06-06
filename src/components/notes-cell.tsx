"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { updateNotes } from "@/app/actions/update-notes";

interface NotesCellProps {
  placeId: string;
  value: string | null;
}

function notesPreview(value: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const firstLine = trimmed.split(/\r?\n/)[0] ?? trimmed;
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

export function NotesCell({ placeId, value }: NotesCellProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const preview = notesPreview(value);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <>
      <button
        type="button"
        className="max-w-[9rem] truncate rounded-md border border-transparent px-1.5 py-1 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
        title={value?.trim() || "Add notes"}
        onClick={() => {
          setDraft(value ?? "");
          dialogRef.current?.showModal();
        }}
      >
        {preview || <span className="text-zinc-400">—</span>}
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(100vw-2rem,28rem)] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        onClose={() => setDraft(value ?? "")}
      >
        <form
          method="dialog"
          className="flex flex-col gap-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            const previous = (value ?? "").trim();
            if (trimmed === previous) {
              dialogRef.current?.close();
              return;
            }

            setPending(true);
            const res = await updateNotes(placeId, trimmed || null);
            setPending(false);
            if (res.ok) {
              dialogRef.current?.close();
              router.refresh();
            } else {
              window.alert(res.error);
            }
          }}
        >
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Notes
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Private notes for this lead.
            </p>
          </div>
          <textarea
            rows={6}
            maxLength={2000}
            disabled={pending}
            value={draft}
            aria-label="Lead notes"
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
