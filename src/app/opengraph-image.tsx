import { ImageResponse } from "next/og";

export const alt = "No Website Business Leads — B2B lead lists for web designers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          B2B lead lists for web designers — restaurants, salons, contractors, and more
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
