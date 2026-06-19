import { headers } from "next/headers";
import { PublicNav } from "@/components/public-nav";
import { SiteFooter } from "@/components/site-footer";
import { isRingReadyHost } from "@/lib/ringready-site";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = isRingReadyHost(host);

  if (isRingReady) {
    return <>{children}</>;
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
