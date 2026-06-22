import { RingReadySmsOptInSection } from "@/components/ringready-sms-opt-in-section";

interface RingReadyHomeProps {
  searchParams?: {
    subscribed?: string;
    error?: string;
  };
}

export function RingReadyHome({ searchParams }: RingReadyHomeProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          RingReadySite
        </h1>
        <p className="text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
          Demo websites for cold outreach — show local businesses what their
          site could look like.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          RingReadySite is a service of Suite300.
        </p>
      </div>

      <RingReadySmsOptInSection
        subscribed={searchParams?.subscribed}
        error={searchParams?.error}
      />
    </main>
  );
}
