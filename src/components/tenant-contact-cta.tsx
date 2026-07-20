"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import {
  buildDemoEmailHref,
  buildDemoSmsHref,
} from "@/lib/demo-contact-links";

const MOBILE_QUERY = "(max-width: 767px)";

interface TenantContactCtaProps {
  businessName: string;
  outreachPhone: string | null;
}

export function TenantContactCta({
  businessName,
  outreachPhone,
}: TenantContactCtaProps) {
  // Email is the SSR/default fallback; switch after hydration on mobile.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const canText = isMobile && outreachPhone;
  const href = canText
    ? buildDemoSmsHref(businessName, outreachPhone)
    : buildDemoEmailHref(businessName);
  const label = canText
    ? "Text us — 30 days free, keep it only if it works."
    : "Email us — 30 days free, keep it only if it works.";
  const Icon = canText ? MessageSquare : Mail;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-label="Get your free website"
    >
      <div className="mx-auto max-w-3xl">
        <a
          href={href}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md"
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          <span>{label}</span>
        </a>
      </div>
    </aside>
  );
}
