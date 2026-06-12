"use client";

import { useState } from "react";
import { updateTwilioSettings } from "@/lib/actions/twilio-settings";
import type { TwilioProfilePublic } from "@/lib/subscription";

interface TwilioSettingsFormProps {
  initialTwilio: TwilioProfilePublic;
}

export function TwilioSettingsForm({ initialTwilio }: TwilioSettingsFormProps) {
  const [accountSid, setAccountSid] = useState(initialTwilio.twilio_account_sid);
  const [authToken, setAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(
    initialTwilio.twilio_phone_number,
  );
  const [forwardingNumber, setForwardingNumber] = useState(
    initialTwilio.forwarding_number,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initialTwilio.is_active);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const result = await updateTwilioSettings({
      twilio_account_sid: accountSid,
      twilio_auth_token: authToken,
      twilio_phone_number: twilioPhoneNumber,
      forwarding_number: forwardingNumber,
    });

    setPending(false);
    if (result.ok) {
      const cleared =
        !accountSid.trim() &&
        !authToken.trim() &&
        !twilioPhoneNumber.trim() &&
        !forwardingNumber.trim();
      setIsActive(!cleared);
      setAuthToken("");
      setMessage(
        cleared
          ? "Pro communications disconnected."
          : "Pro communications saved and verified.",
      );
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Pro communications
          </h2>
          {isActive ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Standard mode
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect your Twilio account to send SMS and place calls from your business
          line. Without credentials, call and SMS use your device&apos;s default apps.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="twilio_account_sid"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Twilio Account SID
        </label>
        <input
          id="twilio_account_sid"
          name="twilio_account_sid"
          type="text"
          autoComplete="off"
          value={accountSid}
          onChange={(event) => setAccountSid(event.target.value)}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="twilio_auth_token"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Twilio Auth Token
        </label>
        <input
          id="twilio_auth_token"
          name="twilio_auth_token"
          type="password"
          autoComplete="off"
          value={authToken}
          onChange={(event) => setAuthToken(event.target.value)}
          placeholder={
            initialTwilio.has_twilio_auth_token
              ? "Leave blank to keep existing token"
              : "Your Twilio auth token"
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="twilio_phone_number"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Twilio phone number
        </label>
        <input
          id="twilio_phone_number"
          name="twilio_phone_number"
          type="tel"
          autoComplete="off"
          value={twilioPhoneNumber}
          onChange={(event) => setTwilioPhoneNumber(event.target.value)}
          placeholder="+15551234567"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          E.164 format. Used as caller ID and SMS sender.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="forwarding_number"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Forwarding number
        </label>
        <input
          id="forwarding_number"
          name="forwarding_number"
          type="tel"
          autoComplete="off"
          value={forwardingNumber}
          onChange={(event) => setForwardingNumber(event.target.value)}
          placeholder="+15559876543"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Your phone rings first; when you answer, the call bridges to the lead.
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
        {pending ? "Validating…" : "Save Pro communications"}
      </button>
    </form>
  );
}
