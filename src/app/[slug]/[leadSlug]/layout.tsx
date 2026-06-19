import { headers } from "next/headers";
import { isRingReadyHost } from "@/lib/ringready-site";

export default async function TenantDemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = isRingReadyHost(host);

  if (isRingReady) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-24">
      {children}
      <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Preview demo site generated for sales outreach. Not affiliated with the
        business shown.
      </footer>
    </div>
  );
}
