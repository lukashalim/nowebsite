import { RingReadySmsOptInSection } from "@/components/ringready-sms-opt-in-section";
import {
  COMPLIANCE_SERVICE_ATTRIBUTION,
  LEGAL_COMPANY_NAME,
} from "@/lib/legal-placeholders";

interface RingReadyHomeProps {
  searchParams?: {
    subscribed?: string;
    error?: string;
  };
}

export function RingReadyHome({ searchParams }: RingReadyHomeProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {LEGAL_COMPANY_NAME}
        </h1>
        <p className="text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
          {LEGAL_COMPANY_NAME} provides web development and project management
          services for businesses. We use SMS to send important project updates
          and notifications to our clients.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {COMPLIANCE_SERVICE_ATTRIBUTION}
        </p>
      </div>

      <RingReadySmsOptInSection
        subscribed={searchParams?.subscribed}
        error={searchParams?.error}
      />
    </main>
  );
}
