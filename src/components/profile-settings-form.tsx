"use client";

import { useState } from "react";
import { updateProfileSettings } from "@/lib/actions/profile";
import { DEFAULT_PAYMENT_LINK } from "@/lib/tenant-payment-defaults";

interface ProfileSettingsFormProps {
  initialUsername: string;
  initialPaymentLink: string;
}

export function ProfileSettingsForm({
  initialUsername,
  initialPaymentLink,
}: ProfileSettingsFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const [userPaymentLink, setUserPaymentLink] = useState(initialPaymentLink);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const result = await updateProfileSettings({
      username,
      user_payment_link: userPaymentLink,
    });

    setPending(false);
    if (result.ok) {
      setMessage("Settings saved.");
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="space-y-2">
        <label
          htmlFor="username"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="jane-doe"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Public demo URLs use{" "}
          <span className="font-mono text-zinc-600 dark:text-zinc-300">
            /{username.trim() || "username"}/{"{slug}"}
          </span>
          . Lowercase letters, numbers, hyphens, and underscores only.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="user_payment_link"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Stripe payment link
        </label>
        <input
          id="user_payment_link"
          name="user_payment_link"
          type="url"
          value={userPaymentLink}
          onChange={(event) => setUserPaymentLink(event.target.value)}
          placeholder="https://buy.stripe.com/..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Shown on demo pages as the &quot;Activate site — $27/mo&quot; button.
          Leave blank to use the platform default (
          <span className="font-mono">{DEFAULT_PAYMENT_LINK}</span>).
        </p>
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
