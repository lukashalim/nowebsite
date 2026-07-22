"use client";

import { useState } from "react";
import { updateTelegramSettings } from "@/lib/actions/telegram-settings";

interface TelegramSettingsFormProps {
  initialChatId: string;
  botConfigured: boolean;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

export function TelegramSettingsForm({
  initialChatId,
  botConfigured,
}: TelegramSettingsFormProps) {
  const [chatId, setChatId] = useState(initialChatId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(sendTest: boolean) {
    setPending(true);
    setMessage(null);
    setError(null);

    const result = await updateTelegramSettings({
      telegram_chat_id: chatId,
      send_test: sendTest,
    });

    setPending(false);
    if (result.ok) {
      setMessage(
        !chatId.trim()
          ? "Telegram alerts cleared."
          : result.tested
            ? "Saved. Check Telegram for the test message."
            : "Telegram chat id saved.",
      );
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Telegram scan alerts
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Get a Telegram message the first time a lead scans a postcard QR.
          Test-key scans are labeled as test in the message.
        </p>
      </div>

      {!botConfigured ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Server needs <span className="font-mono">TELEGRAM_BOT_TOKEN</span>{" "}
          (BotFather) before alerts can send.
        </p>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="telegram_chat_id"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Chat ID
        </label>
        <input
          id="telegram_chat_id"
          name="telegram_chat_id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          placeholder="123456789"
          className={inputClass}
        />
        <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
          <li>Message your bot in Telegram (open a chat and tap Start).</li>
          <li>
            Open{" "}
            <span className="font-mono">
              https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </span>{" "}
            and copy{" "}
            <span className="font-mono">message.chat.id</span>.
          </li>
          <li>Paste the id here, then Save &amp; test.</li>
        </ol>
      </div>

      {message ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending || !chatId.trim() || !botConfigured}
          onClick={() => void save(true)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Save &amp; test
        </button>
      </div>
    </form>
  );
}
