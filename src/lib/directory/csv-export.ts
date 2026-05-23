import type { DirectoryBusiness } from "@/lib/directory/types";

const CSV_COLUMNS = [
  "name",
  "rating",
  "reviews",
  "phone",
  "google_maps_link",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  return escapeCsvField(String(value));
}

export function buildDirectoryBusinessesCsv(
  businesses: DirectoryBusiness[],
): string {
  const header = CSV_COLUMNS.join(",");
  const rows = businesses.map((b) =>
    [
      cell(b.name),
      cell(b.rating),
      cell(b.reviews),
      cell(b.phone),
      cell(b.google_maps_link),
    ].join(","),
  );
  return [header, ...rows].join("\r\n");
}

export function csvFilenameFromPagePath(pagePath: string): string {
  const slug = pagePath.replace(/^\//, "").replace(/\//g, "-") || "listings";
  return `${slug}-businesses.csv`;
}
