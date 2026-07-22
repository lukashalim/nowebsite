"use client";

import { useState } from "react";
import {
  clearLobSettings,
  updateLobSettings,
} from "@/lib/actions/lob-settings";
import type { LobProfilePublic } from "@/lib/subscription";

interface LobSettingsFormProps {
  initialLob: LobProfilePublic;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

export function LobSettingsForm({ initialLob }: LobSettingsFormProps) {
  const [testApiKey, setTestApiKey] = useState("");
  const [liveApiKey, setLiveApiKey] = useState("");
  const [name, setName] = useState(initialLob.return_address.name);
  const [line1, setLine1] = useState(initialLob.return_address.address_line1);
  const [line2, setLine2] = useState(initialLob.return_address.address_line2);
  const [city, setCity] = useState(initialLob.return_address.address_city);
  const [state, setState] = useState(initialLob.return_address.address_state);
  const [zip, setZip] = useState(initialLob.return_address.address_zip);
  const [contactPhone, setContactPhone] = useState(
    initialLob.return_address.contact_phone,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasTestKey, setHasTestKey] = useState(initialLob.has_lob_test_api_key);
  const [hasLiveKey, setHasLiveKey] = useState(initialLob.has_lob_live_api_key);
  const [hasAddress, setHasAddress] = useState(initialLob.has_return_address);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const result = await updateLobSettings({
      lob_test_api_key: testApiKey,
      lob_live_api_key: liveApiKey,
      return_address: {
        name,
        address_line1: line1,
        address_line2: line2,
        address_city: city,
        address_state: state,
        address_zip: zip,
        contact_phone: contactPhone,
      },
    });

    setPending(false);
    if (result.ok) {
      setHasTestKey(result.has_lob_test_api_key);
      setHasLiveKey(result.has_lob_live_api_key);
      setHasAddress(result.has_return_address);
      setTestApiKey("");
      setLiveApiKey("");
      const parts: string[] = [];
      if (result.has_lob_test_api_key) parts.push("test");
      if (result.has_lob_live_api_key) parts.push("production");
      setMessage(
        `Lob settings saved (${parts.join(" + ")} key${parts.length === 1 ? "" : "s"}).`,
      );
    } else {
      setError(result.error);
    }
  }

  async function handleClear() {
    setPending(true);
    setMessage(null);
    setError(null);
    const result = await clearLobSettings();
    setPending(false);
    if (result.ok) {
      setHasTestKey(false);
      setHasLiveKey(false);
      setHasAddress(false);
      setTestApiKey("");
      setLiveApiKey("");
      setName("");
      setLine1("");
      setLine2("");
      setCity("");
      setState("");
      setZip("");
      setContactPhone("");
      setMessage("Lob API keys and return address removed.");
    } else {
      setError(result.error);
    }
  }

  const hasAnyKey = hasTestKey || hasLiveKey;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Lob postcards
          </h2>
          {hasTestKey ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              Test key
            </span>
          ) : null}
          {hasLiveKey ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              Live key
            </span>
          ) : null}
          {hasAddress ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Address set
            </span>
          ) : null}
          {!hasAnyKey ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Not connected
            </span>
          ) : null}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Save both Lob <span className="font-medium">secret</span> API keys
          (must start with <code className="text-xs">test_</code> or{" "}
          <code className="text-xs">live_</code> — not{" "}
          <code className="text-xs">*_pub</code>) and your return address. CRM
          Mail <span className="font-medium">Test</span> uses the test key;{" "}
          <span className="font-medium">Production</span> uses the live key.
          Free accounts get unlimited test proofs and one live postcard ever;
          Pro is unlimited.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="lob_test_api_key"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Test API key
        </label>
        <input
          id="lob_test_api_key"
          name="lob_test_api_key"
          type="password"
          autoComplete="off"
          value={testApiKey}
          onChange={(event) => setTestApiKey(event.target.value)}
          placeholder={
            hasTestKey ? "Leave blank to keep existing test key" : "test_…"
          }
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Must start with <code className="font-mono">test_</code> (Lob secret
          key).
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="lob_live_api_key"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Production API key
        </label>
        <input
          id="lob_live_api_key"
          name="lob_live_api_key"
          type="password"
          autoComplete="off"
          value={liveApiKey}
          onChange={(event) => setLiveApiKey(event.target.value)}
          placeholder={
            hasLiveKey ? "Leave blank to keep existing live key" : "live_…"
          }
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Must start with <code className="font-mono">live_</code> (Lob secret
          key).
        </p>
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Return address
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Shown as the sender on the postcard. Use a deliverable US address.
        </p>

        <div className="space-y-2">
          <label
            htmlFor="return_name"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Name
          </label>
          <input
            id="return_name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name or business"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="return_line1"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Street address
          </label>
          <input
            id="return_line1"
            type="text"
            autoComplete="address-line1"
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            placeholder="123 Main St"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="return_line2"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Apt / suite{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="return_line2"
            type="text"
            autoComplete="address-line2"
            value={line2}
            onChange={(event) => setLine2(event.target.value)}
            placeholder="Suite 100"
            className={inputClass}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <label
              htmlFor="return_city"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              City
            </label>
            <input
              id="return_city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="return_state"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              State
            </label>
            <input
              id="return_state"
              type="text"
              autoComplete="address-level1"
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder="MD"
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="return_zip"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              ZIP
            </label>
            <input
              id="return_zip"
              type="text"
              autoComplete="postal-code"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              placeholder="21201"
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="return_phone"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Contact phone{" "}
            <span className="font-normal text-zinc-500">(for QR card)</span>
          </label>
          <input
            id="return_phone"
            type="tel"
            autoComplete="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="(555) 123-4567"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Printed under the QR as “Call/text us at …”. Falls back to your Twilio
            number if blank.
          </p>
        </div>
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

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save Lob settings"}
        </button>
        {hasAnyKey || hasAddress ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleClear()}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Remove Lob settings
          </button>
        ) : null}
      </div>
    </form>
  );
}
