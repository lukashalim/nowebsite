"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Flame, Leaf, Scissors, Trees, X } from "lucide-react";
import type { ClientSiteService } from "@/lib/client-sites";

const SERVICE_ICONS = [Trees, Scissors, Leaf, Flame] as const;

const FIELD_CLASS =
  "mt-1 w-full rounded-lg border border-[#d9d0bc] bg-white px-3 py-2 text-sm text-[#1b2b1c] outline-none focus:border-[#2f6b3a] focus:ring-2 focus:ring-[#2f6b3a]/20";

const CARD_CLASS =
  "group flex h-full w-full cursor-pointer flex-col rounded-2xl border-2 border-[#d9d0bc] bg-white p-5 text-left shadow-sm transition duration-150 ease-in-out hover:-translate-y-0.5 hover:border-[#2f6b3a] hover:shadow-[0_8px_24px_rgba(16,24,16,0.12)] focus-visible:-translate-y-0.5 focus-visible:border-[#2f6b3a] focus-visible:shadow-[0_8px_24px_rgba(16,24,16,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6b3a]";

const PEEK_CARD_CLASS =
  "group flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 border-[#d9d0bc] bg-white p-4 text-left text-[#1b2b1c] shadow-sm transition duration-150 ease-in-out hover:-translate-y-0.5 hover:border-[#2f6b3a] hover:shadow-[0_8px_24px_rgba(16,24,16,0.12)] focus-visible:-translate-y-0.5 focus-visible:border-[#2f6b3a] focus-visible:shadow-[0_8px_24px_rgba(16,24,16,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6b3a]";

interface ServiceFlowValue {
  services: ClientSiteService[];
  openRequest: (title: string) => void;
}

const ServiceFlowContext = createContext<ServiceFlowValue | null>(null);

function useServiceFlow(): ServiceFlowValue {
  const value = useContext(ServiceFlowContext);
  if (!value) {
    throw new Error("Client site services need ClientSiteServiceFlow");
  }
  return value;
}

interface ClientSiteServiceFlowProps {
  siteId: string;
  services: ClientSiteService[];
  shortDba?: string;
  children: ReactNode;
}

export function ClientSiteServiceFlow({
  siteId,
  services,
  shortDba,
  children,
}: ClientSiteServiceFlowProps) {
  const titleId = useId();
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const active = services.find((service) => service.title === activeTitle);
  const submitLabel = shortDba?.trim()
    ? `Text ${shortDba.trim()}`
    : "Send it to the owner";

  useEffect(() => {
    if (!activeTitle) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRequest();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [activeTitle, submitting]);

  function openRequest(title: string) {
    setActiveTitle(title);
    setAddress("");
    setPhone("");
    setCompany("");
    setError(null);
    setDone(false);
  }

  function closeRequest() {
    if (submitting) return;
    setActiveTitle(null);
    setError(null);
    setDone(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/client-site-service-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          serviceTitle: active.title,
          address,
          phone,
          company,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(
          payload?.error || "Could not send it. Call instead if you need.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Could not send it. Call instead if you need.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ServiceFlowContext.Provider value={{ services, openRequest }}>
      {children}
      {active ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1b2b1c]/40 p-4 sm:items-center"
          role="presentation"
          onClick={closeRequest}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl border border-[#d9d0bc] bg-[#f7f3e9] p-5 shadow-xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a7340]">
                  GET A CALLBACK
                </p>
                <h3
                  id={titleId}
                  className="mt-1 text-xl font-bold tracking-tight"
                >
                  {active.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRequest}
                className="rounded-full p-1 text-[#3d5340] hover:bg-white"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {done ? (
              <div className="mt-5 space-y-4">
                <p className="rounded-lg border border-[#c6dcc9] bg-white px-3 py-3 text-sm leading-relaxed text-[#245830]">
                  Sent. The owner will get a text with your address and number.
                </p>
                <button
                  type="button"
                  onClick={closeRequest}
                  className="w-full rounded-lg bg-[#2f6b3a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245830]"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <p className="text-sm text-[#3d5340]">
                  Leave your address and phone. The owner gets a text and
                  replies from his cell.
                </p>
                <label className="block text-sm font-medium">
                  Address
                  <textarea
                    name="address"
                    required
                    minLength={8}
                    maxLength={200}
                    rows={3}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    autoComplete="street-address"
                    placeholder="Street, city, ZIP"
                    autoFocus
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Phone
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="(740) 555-1212"
                    className={FIELD_CLASS}
                  />
                </label>
                <div className="hidden" aria-hidden="true">
                  <label>
                    Company
                    <input
                      type="text"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                    />
                  </label>
                </div>
                {error ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#2f6b3a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245830] disabled:opacity-60"
                >
                  {submitting ? "Sending…" : submitLabel}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </ServiceFlowContext.Provider>
  );
}

export function ClientSiteServicePeek() {
  const { services, openRequest } = useServiceFlow();
  const peek = services.slice(0, 3);
  if (peek.length === 0) return null;

  return (
    <ul className="hidden gap-3 lg:grid">
      {peek.map((service, index) => {
        const Icon = SERVICE_ICONS[index] ?? Trees;
        return (
          <li key={service.title}>
            <button
              type="button"
              onClick={() => openRequest(service.title)}
              className={PEEK_CARD_CLASS}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-[#2f6b3a]" aria-hidden />
              <span className="min-w-0">
                <span className="block font-semibold">{service.title}</span>
                <span className="mt-1 block text-sm font-semibold text-[#2f6b3a] group-hover:text-[#245830] group-hover:underline group-focus-visible:text-[#245830] group-focus-visible:underline">
                  Get a text-back on this
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ClientSiteServices() {
  const { services, openRequest } = useServiceFlow();

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {services.map((service, index) => {
        const Icon = SERVICE_ICONS[index] ?? Trees;
        return (
          <li key={service.title}>
            <button
              type="button"
              onClick={() => openRequest(service.title)}
              className={CARD_CLASS}
            >
              <Icon className="size-6 text-[#2f6b3a]" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3d5340]">
                {service.description}
              </p>
              <span className="mt-4 text-sm font-semibold text-[#2f6b3a] group-hover:text-[#245830] group-hover:underline group-focus-visible:text-[#245830] group-focus-visible:underline">
                Get a text-back on this
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
