import type { BusinessLead } from "@/lib/business";

const CSV_COLUMNS = [
  "name",
  "city",
  "state",
  "postal_code",
  "rating",
  "reviews",
  "phone",
  "main_category",
  "stage",
  "owner_name",
  "contact_count",
  "google_maps_link",
  "demo_url",
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

export function buildCrmLeadsCsv(rows: BusinessLead[], demoBaseUrl: string): string {
  const header = CSV_COLUMNS.join(",");
  const origin = demoBaseUrl.replace(/\/$/, "");

  const dataRows = rows.map((b) => {
    const demoSegment = b.demo_slug?.trim() || b.place_id;
    const demoUrl = `${origin}/demo/${demoSegment}`;

    return [
      cell(b.name),
      cell(b.city),
      cell(b.state),
      cell(b.postal_code),
      cell(b.rating),
      cell(b.reviews),
      cell(b.phone),
      cell(b.main_category),
      cell(b.stage),
      cell(b.owner_name),
      cell(b.contact_count),
      cell(b.google_maps_link),
      cell(demoUrl),
    ].join(",");
  });

  return [header, ...dataRows].join("\r\n");
}

export function crmExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `crm-leads-${date}.csv`;
}
