import {
  buildDirectoryBusinessesCsv,
  csvFilenameFromPagePath,
} from "@/lib/directory/csv-export";
import {
  fetchFacebookDirectoryAllListings,
  fetchNationwideCategoryAllListings,
  fetchStateAllListings,
} from "@/lib/directory/data";

export interface DirectoryExportResult {
  csv: string;
  filename: string;
}

export async function buildDirectoryExport(
  type: "category" | "state" | "facebook",
  slug?: string,
): Promise<DirectoryExportResult | null> {
  if (type === "facebook") {
    const data = await fetchFacebookDirectoryAllListings();
    if (!data) return null;
    return {
      csv: buildDirectoryBusinessesCsv(data.businesses),
      filename: csvFilenameFromPagePath("/facebook"),
    };
  }

  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const data =
    type === "category"
      ? await fetchNationwideCategoryAllListings(normalizedSlug)
      : await fetchStateAllListings(normalizedSlug);

  if (!data) return null;

  return {
    csv: buildDirectoryBusinessesCsv(data.businesses),
    filename: csvFilenameFromPagePath(`/${normalizedSlug}`),
  };
}
