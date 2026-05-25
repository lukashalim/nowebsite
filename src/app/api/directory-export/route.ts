import { NextResponse } from "next/server";
import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import { fetchNationwideCategoryAllListings } from "@/lib/directory/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();
  const type = searchParams.get("type")?.trim().toLowerCase();

  if (!slug || type !== "category") {
    return NextResponse.json({ error: "Invalid export request" }, { status: 400 });
  }

  const data = await fetchNationwideCategoryAllListings(slug);
  if (!data) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const csv = buildDirectoryBusinessesCsv(data.businesses);
  const filename = csvFilenameFromPagePath(`/${slug}`);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
