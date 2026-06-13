"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createSpintaxTemplate,
  deleteSpintaxTemplate,
  updateSpintaxTemplate,
} from "@/app/actions/spintax-templates";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { buildSpintaxPreview } from "@/lib/outreach-spintax";
import {
  SPINTAX_AUDIENCE_LABELS,
  SPINTAX_AUDIENCE_VALUES,
  type SpintaxAudience,
} from "@/lib/spintax-audience";
import {
  SPINTAX_CHANNEL_LABELS,
  SPINTAX_CHANNEL_VALUES,
  type SpintaxChannel,
} from "@/lib/spintax-channel";
import type { SpintaxTemplate } from "@/lib/spintax-templates";

interface SpintaxTemplateEditorProps {
  initialTemplates: SpintaxTemplate[];
}

function firstTemplateInChannel(
  templates: SpintaxTemplate[],
  channel: SpintaxChannel,
): SpintaxTemplate | null {
  return templates.find((t) => t.channel === channel) ?? null;
}

function defaultAudienceForChannel(channel: SpintaxChannel): SpintaxAudience {
  return channel === "facebook" ? "facebook" : "any";
}

export function SpintaxTemplateEditor({
  initialTemplates,
}: SpintaxTemplateEditorProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeChannel, setActiveChannel] = useState<SpintaxChannel>("facebook");
  const [selectedId, setSelectedId] = useState(
    firstTemplateInChannel(initialTemplates, "facebook")?.id ?? "",
  );
  const [name, setName] = useState(
    firstTemplateInChannel(initialTemplates, "facebook")?.name ?? "",
  );
  const [template, setTemplate] = useState(
    firstTemplateInChannel(initialTemplates, "facebook")?.template ?? "",
  );
  const [audience, setAudience] = useState<SpintaxAudience>(
    firstTemplateInChannel(initialTemplates, "facebook")?.audience ?? "facebook",
  );
  const [preview, setPreview] = useState("");
  const [previewSeed, setPreviewSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === activeChannel),
    [templates, activeChannel],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const groupedTemplates = useMemo(() => {
    const groups: Record<SpintaxAudience, SpintaxTemplate[]> = {
      facebook: [],
      no_facebook: [],
      any: [],
    };
    for (const t of channelTemplates) {
      groups[t.audience].push(t);
    }
    return groups;
  }, [channelTemplates]);

  useEffect(() => {
    if (!selectedTemplate || selectedTemplate.channel !== activeChannel) return;
    setName(selectedTemplate.name);
    setTemplate(selectedTemplate.template);
    setAudience(selectedTemplate.audience);
  }, [selectedTemplate, activeChannel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreview(buildSpintaxPreview(template));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [template, previewSeed]);

  function selectTemplate(next: SpintaxTemplate) {
    setSelectedId(next.id);
    setName(next.name);
    setTemplate(next.template);
    setAudience(next.audience);
    setMessage(null);
    setError(null);
  }

  function switchChannel(nextChannel: SpintaxChannel) {
    setActiveChannel(nextChannel);
    setMessage(null);
    setError(null);
    const first = firstTemplateInChannel(templates, nextChannel);
    if (first) {
      selectTemplate(first);
    } else {
      setSelectedId("");
      setName("");
      setTemplate("");
      setAudience(defaultAudienceForChannel(nextChannel));
    }
  }

  async function save() {
    if (!selectedId) return;
    setPending(true);
    setMessage(null);
    setError(null);
    const res = await updateSpintaxTemplate(
      selectedId,
      name,
      template,
      audience,
      activeChannel,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedId
          ? {
              ...t,
              name: name.trim(),
              template,
              audience,
              channel: activeChannel,
            }
          : t,
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
      defaultAudienceForChannel(activeChannel),
      activeChannel,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTemplates((prev) => [...prev, res.template]);
    selectTemplate(res.template);
    router.refresh();
  }

  async function removeTemplate() {
    if (!selectedId || !selectedTemplate) return;
    const confirmed = window.confirm(
      `Delete "${selectedTemplate.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setPending(true);
    setMessage(null);
    setError(null);
    const res = await deleteSpintaxTemplate(selectedId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const remaining = templates.filter((t) => t.id !== selectedId);
    setTemplates(remaining);
    const next = firstTemplateInChannel(remaining, activeChannel);
    if (next) {
      selectTemplate(next);
    } else {
      setSelectedId("");
      setName("");
      setTemplate("");
      setAudience(defaultAudienceForChannel(activeChannel));
    }
    setMessage("Deleted");
    router.refresh();
  }

  const tabClass = (channel: SpintaxChannel) =>
    channel === activeChannel
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

  if (templates.length === 0 && channelTemplates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          {SPINTAX_CHANNEL_VALUES.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => switchChannel(channel)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tabClass(channel)}`}
            >
              {SPINTAX_CHANNEL_LABELS[channel]}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No {SPINTAX_CHANNEL_LABELS[activeChannel].toLowerCase()} templates yet.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={addTemplate}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add template
        </button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
        {SPINTAX_CHANNEL_VALUES.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => switchChannel(channel)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tabClass(channel)}`}
          >
            {SPINTAX_CHANNEL_LABELS[channel]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
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
          {channelTemplates.length === 0 ? (
            <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
              No templates in this channel yet.
            </p>
          ) : (
            <div className="space-y-4">
              {SPINTAX_AUDIENCE_VALUES.map((groupAudience) => {
                const items = groupedTemplates[groupAudience];
                if (items.length === 0) return null;
                return (
                  <div key={groupAudience} className="space-y-1">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {SPINTAX_AUDIENCE_LABELS[groupAudience]}
                    </p>
                    <ul className="space-y-1">
                      {items.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => selectTemplate(t)}
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
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href={CRM_BASE_PATH}
            className="inline-block text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Back to CRM
          </Link>
        </aside>

        <div className="space-y-4">
          {selectedTemplate ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Lead type
                </span>
                <select
                  value={audience}
                  disabled={pending}
                  onChange={(e) => setAudience(e.target.value as SpintaxAudience)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {SPINTAX_AUDIENCE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {SPINTAX_AUDIENCE_LABELS[value]}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {activeChannel === "facebook"
                    ? "Facebook listing templates show for leads using Facebook as their website. No Facebook templates show for plain no-website leads."
                    : activeChannel === "sms"
                      ? "SMS templates can target Facebook leads, no-Facebook leads, or any lead type."
                      : "Call scripts can target Facebook leads, no-Facebook leads, or any lead type."}
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Name
                </span>
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeTemplate}
                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Delete
                </button>
                {message ? (
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">
                    {message}
                  </span>
                ) : null}
                {error ? (
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Select a template or add one to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
