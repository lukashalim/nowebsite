"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createSpintaxTemplate,
  updateSpintaxTemplate,
} from "@/app/actions/spintax-templates";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { buildSpintaxPreview } from "@/lib/outreach-spintax";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface SpintaxTemplateEditorProps {
  initialTemplates: SpintaxTemplate[];
}

export function SpintaxTemplateEditor({
  initialTemplates,
}: SpintaxTemplateEditorProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? "");
  const [name, setName] = useState(initialTemplates[0]?.name ?? "");
  const [template, setTemplate] = useState(initialTemplates[0]?.template ?? "");
  const [preview, setPreview] = useState("");
  const [previewSeed, setPreviewSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setName(selectedTemplate.name);
    setTemplate(selectedTemplate.template);
  }, [selectedTemplate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreview(buildSpintaxPreview(template));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [template, previewSeed]);

  function selectTemplate(id: string) {
    const next = templates.find((t) => t.id === id);
    if (!next) return;
    setSelectedId(id);
    setName(next.name);
    setTemplate(next.template);
    setMessage(null);
    setError(null);
  }

  async function save() {
    if (!selectedId) return;
    setPending(true);
    setMessage(null);
    setError(null);
    const res = await updateSpintaxTemplate(selectedId, name, template);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedId ? { ...t, name: name.trim(), template } : t,
      ),
    );
    setMessage("Saved");
    router.refresh();
  }

  async function addTemplate() {
    setPending(true);
    setMessage(null);
    setError(null);
    const res = await createSpintaxTemplate(
      "New template",
      "{Hey|Hi} [Name] - {your message here}.",
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTemplates((prev) => [...prev, res.template]);
    setSelectedId(res.template.id);
    setName(res.template.name);
    setTemplate(res.template.template);
    router.refresh();
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No templates yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Templates
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={addTemplate}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Add
          </button>
        </div>
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => selectTemplate(t.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  t.id === selectedId
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        <Link
          href={CRM_BASE_PATH}
          className="inline-block text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to CRM
        </Link>
      </aside>

      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Name</span>
          <input
            type="text"
            value={name}
            disabled={pending}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Template
          </span>
          <textarea
            rows={10}
            value={template}
            disabled={pending}
            maxLength={4000}
            onChange={(e) => setTemplate(e.target.value)}
            className="font-mono rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Use {"{option A|option B}"} for spintax and [Name] / [category] for
            lead tokens.
          </span>
        </label>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Live preview
            </h3>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPreviewSeed((n) => n + 1)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Refresh preview
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {preview || "…"}
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Save
          </button>
          {message ? (
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              {message}
            </span>
          ) : null}
          {error ? (
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
