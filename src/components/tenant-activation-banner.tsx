interface TenantActivationBannerProps {
  paymentLink: string;
}

export function TenantActivationBanner({ paymentLink }: TenantActivationBannerProps) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-amber-400 bg-zinc-950 px-4 py-3 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.35)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-label="Activate your site"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium leading-snug sm:max-w-md">
          Ready to go live? Activate this demo site for your client —{" "}
          <span className="font-semibold text-amber-300">$27/mo</span>.
        </p>
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 sm:w-auto"
        >
          Activate site — $27/mo
        </a>
      </div>
    </aside>
  );
}
