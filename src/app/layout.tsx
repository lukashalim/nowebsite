import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { CrispChat } from "@/components/crisp-chat";
import { GoogleAnalytics } from "@/components/google-analytics";
import { LegalFooter } from "@/components/legal-footer";
import { SiteJsonLdScript } from "@/components/site-jsonld-script";
import {
  clientSiteGaMeasurementId,
  getClientSiteByHost,
} from "@/lib/client-sites";
import {
  isRingReadyHost,
  RING_READY_ORIGIN,
} from "@/lib/ringready-site";
import { getSiteOrigin } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const clientSite = getClientSiteByHost(host);
  if (clientSite) {
    return {
      metadataBase: new URL(clientSite.origin),
      title: {
        default: clientSite.name,
        template: "%s",
      },
      description: clientSite.description,
    };
  }
  if (isRingReadyHost(host)) {
    return {
      metadataBase: new URL(RING_READY_ORIGIN),
      title: {
        default: "RingReadySite",
        template: "%s | RingReadySite",
      },
      description:
        "Demo websites for cold outreach — show local businesses what their site could look like.",
    };
  }

  return {
    metadataBase: new URL(getSiteOrigin()),
    title: {
      default: "Businesses Without a Website | Lead Lists for Web Designers",
      template: "%s | No Website Business Leads",
    },
    description:
      "Find businesses without a website — including restaurants without a website and salons without a website. B2B lead lists for web designers and agencies.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = isRingReadyHost(host);
  const clientSite = getClientSiteByHost(host);
  const clientGaId = clientSite
    ? clientSiteGaMeasurementId(clientSite)
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>{!isRingReady && !clientSite ? <SiteJsonLdScript /> : null}</head>
      <body className="min-h-full flex flex-col">
        {children}
        {!clientSite ? <LegalFooter /> : null}
        {!isRingReady && !clientSite ? <CrispChat /> : null}
      </body>
      {clientGaId ? (
        <GoogleAnalytics gaId={clientGaId} />
      ) : !isRingReady && !clientSite ? (
        <GoogleAnalytics />
      ) : null}
    </html>
  );
}
