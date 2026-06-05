import Script from "next/script";

const CRISP_WEBSITE_ID =
  process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "eee6d292-7b9d-4538-83ba-251614f81655";

/** Crisp live chat — loads after hydration on all pages using the root layout. */
export function CrispChat() {
  if (!CRISP_WEBSITE_ID.trim()) {
    return null;
  }

  return (
    <>
      <Script id="crisp-config" strategy="afterInteractive">
        {`window.$crisp=[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";`}
      </Script>
      <Script
        id="crisp-client"
        src="https://client.crisp.chat/l.js"
        strategy="afterInteractive"
      />
    </>
  );
}
