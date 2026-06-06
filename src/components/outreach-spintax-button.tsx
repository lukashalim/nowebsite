"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { buildOutreachMessage } from "@/lib/outreach-spintax";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface OutreachSpintaxButtonProps {
  userId: string;
  businessName: string | null;
  mainCategory: string | null;
  businessType: string | null;
  eligible: boolean;
  templates: SpintaxTemplate[];
}

function lastUsedStorageKey(userId: string): string {
  return `crm:lastSpintaxTemplateId:${userId}`;
}

export function OutreachSpintaxButton({
  userId,
  businessName,
  mainCategory,
  businessType,
  eligible,
  templates,
}: OutreachSpintaxButtonProps) {
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");

  useEffect(() => {
    if (templates.length === 0) return;
    const stored = window.localStorage.getItem(lastUsedStorageKey(userId));
    if (stored && templates.some((t) => t.id === stored)) {
      setSelectedId(stored);
      return;
    }
    setSelectedId(templates[0].id);
  }, [templates, userId]);

  if (!eligible) {
    return <span className="text-zinc-400">—</span>;
  }

  if (templates.length === 0) {
    return <span className="text-xs text-zinc-500">No templates</span>;
  }

  const selectedTemplate =
    templates.find((t) => t.id === selectedId) ?? templates[0];

  async function copy() {
    const message = buildOutreachMessage(selectedTemplate.template, {
      name: businessName,
      mainCategory,
      businessType,
    });
    await navigator.clipboard.writeText(message);
    window.localStorage.setItem(
      lastUsedStorageKey(userId),
      selectedTemplate.id,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-w-[9rem] flex-col gap-1.5">
      <select
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        value={selectedTemplate.id}
        aria-label="Spintax template"
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center justify-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
