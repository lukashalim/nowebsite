import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getClientSiteByHost } from "@/lib/client-sites";
import { isRingReadyHost } from "@/lib/ringready-site";

export const alt = "Local business website";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const host = (await headers()).get("host") ?? "";
  const clientSite = getClientSiteByHost(host);

  if (clientSite) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "64px",
            background: "linear-gradient(135deg, #1b3a2a 0%, #2f6b3a 100%)",
            color: "#f4efe3",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: "0.18em", color: "#c4a35a" }}>
            WASHINGTON COURT HOUSE, OHIO
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: "920px",
            }}
          >
            {clientSite.name}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 28,
              lineHeight: 1.4,
              color: "#e4dcc8",
              maxWidth: "800px",
            }}
          >
            {clientSite.tagline}
          </div>
        </div>
      ),
      { ...size },
    );
  }

  if (isRingReadyHost(host)) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "64px",
            background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
            color: "#fafafa",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.2 }}>
            RingReadySite
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.4,
              color: "#d4d4d8",
            }}
          >
            Demo websites for cold outreach
          </div>
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "64px",
          background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: "900px",
          }}
        >
          Businesses Without a Website
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            lineHeight: 1.4,
            color: "#d4d4d8",
            maxWidth: "800px",
          }}
        >
          B2B lead lists for web designers — restaurants, salons, contractors, and
          more
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: "#f59e0b",
            fontWeight: 600,
          }}
        >
          nowebsitebusinessleads.com
        </div>
      </div>
    ),
    { ...size },
  );
}
