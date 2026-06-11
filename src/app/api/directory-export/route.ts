import { NextResponse } from "next/server";
import { verifyCsvDownloadToken } from "@/lib/csv-download-token";
import { buildDirectoryExport } from "@/lib/directory/build-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyCsvDownloadToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = searchParams.get("slug")?.trim().toLowerCase();
  const type = searchParams.get("type")?.trim().toLowerCase();

  if (type !== payload.type) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (type !== "facebook") {
    if (!slug || slug !== payload.slug) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const exportResult = await buildDirectoryExport(
    payload.type,
    payload.slug ?? slug ?? undefined,
  );

  if (!exportResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(exportResult.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
