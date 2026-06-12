import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { CrispChat } from "@/components/crisp-chat";
import { LegalFooter } from "@/components/legal-footer";
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

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: "No Website Business Leads | Directory for Web Designers",
    template: "%s | No Website Business Leads",
  },
  description:
    "Public directory of local businesses without websites, plus a Pro CRM for web designers and agencies.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const isRingReady = host.includes("ringreadysite.com");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {isRingReady ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : null}
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <LegalFooter />
        <CrispChat />
      </body>
    </html>
  );
}
