import { NextResponse } from "next/server";
import { qrPngBuffer } from "@/lib/postcard/qr";
import { RING_READY_ORIGIN } from "@/lib/ringready-site";

export const runtime = "nodejs";

/**
 * Public QR PNG for Lob postcard HTML (<img src="…">).
 * Lob fetches this over HTTPS — do not require auth.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing u" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid u" }, { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "HTTPS only" }, { status: 400 });
  }

  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "ringreadysite.com" ||
    host === "www.ringreadysite.com" ||
    host.endsWith(".ringreadysite.com");
  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  // Normalize to canonical origin (drop www)
  const demoUrl = `${RING_READY_ORIGIN}${parsed.pathname}${parsed.search}`;

  try {
    const png = await qrPngBuffer(demoUrl);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "QR generation failed",
      },
      { status: 500 },
    );
  }
}
