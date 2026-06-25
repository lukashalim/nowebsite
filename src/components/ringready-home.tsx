import { RingReadySmsOptInSection } from "@/components/ringready-sms-opt-in-section";
import { LEGAL_COMPANY_NAME } from "@/lib/legal-placeholders";

interface RingReadyHomeProps {
  searchParams?: {
    subscribed?: string;
    error?: string;
  };
}

export function RingReadyHome({ searchParams }: RingReadyHomeProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {LEGAL_COMPANY_NAME}
        </h1>
      </div>

      <RingReadySmsOptInSection
        subscribed={searchParams?.subscribed}
        error={searchParams?.error}
      />
    </main>
  );
}
