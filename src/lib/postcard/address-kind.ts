export const POSTCARD_ADDRESS_KINDS = [
  "undeliverable",
  "cmra",
  "shared",
  "po_box",
  "commercial",
  "residential",
  "unknown",
] as const;

export type PostcardAddressKind = (typeof POSTCARD_ADDRESS_KINDS)[number];

/** Other listings at the same street+ZIP5 that trigger the shared (virtual office) bucket. */
export const POSTCARD_ADDRESS_SHARED_PEER_THRESHOLD = 5;

export const OWNER_LIKELY_POSTCARD_ADDRESS_KINDS: readonly PostcardAddressKind[] =
  ["residential", "po_box"];

export function isPostcardAddressKind(
  value: unknown,
): value is PostcardAddressKind {
  return (
    typeof value === "string" &&
    (POSTCARD_ADDRESS_KINDS as readonly string[]).includes(value)
  );
}

export function isOwnerLikelyPostcardAddress(
  kind: PostcardAddressKind | null | undefined,
): boolean {
  return (
    kind === "residential" ||
    kind === "po_box"
  );
}

export function postcardAddressKindLabel(
  kind: PostcardAddressKind | null | undefined,
): string | null {
  switch (kind) {
    case "residential":
      return "Residential";
    case "po_box":
      return "PO Box";
    case "commercial":
      return "Commercial";
    case "cmra":
      return "CMRA";
    case "shared":
      return "Shared";
    case "undeliverable":
      return "Undeliverable";
    case "unknown":
      return "Unknown";
    default:
      return null;
  }
}

/** Lowercased street + ZIP5 occupancy key, or null if incomplete. */
export function occupancyKey(
  address: string | null | undefined,
  postalCode: string | null | undefined,
): string | null {
  const street = String(address ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const zip = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (!street || zip.length < 5) return null;
  return `${street}|${zip}`;
}

export function countOccupancyPeers(
  rows: ReadonlyArray<{
    place_id?: string | null;
    address?: string | null;
    postal_code?: string | null;
  }>,
  key: string | null,
  excludePlaceId?: string | null,
): number {
  if (!key) return 0;
  let n = 0;
  for (const row of rows) {
    if (excludePlaceId && row.place_id === excludePlaceId) continue;
    if (occupancyKey(row.address, row.postal_code) === key) n += 1;
  }
  return n;
}

export function isCmraVerification(input: {
  dpvCmra?: string | null;
  pmbDesignator?: string | null;
  pmbNumber?: string | null;
}): boolean {
  if (String(input.dpvCmra ?? "").trim().toUpperCase() === "Y") return true;
  return Boolean(
    String(input.pmbDesignator ?? "").trim() ||
      String(input.pmbNumber ?? "").trim(),
  );
}

const ACCEPTABLE_DELIVERABILITY = new Set([
  "deliverable",
  "deliverable_unnecessary_unit",
  "deliverable_incorrect_unit",
  "deliverable_missing_unit",
  "deliverable_empty_unit",
]);

function isAcceptableDeliverability(
  deliverability: string | null | undefined,
): boolean {
  if (!deliverability) return false;
  return ACCEPTABLE_DELIVERABILITY.has(deliverability);
}

export function classifyPostcardAddressKind(input: {
  deliverability: string | null | undefined;
  addressType?: string | null;
  recordType?: string | null;
  dpvCmra?: string | null;
  pmbDesignator?: string | null;
  pmbNumber?: string | null;
  peerCount?: number | null;
}): PostcardAddressKind {
  if (!isAcceptableDeliverability(input.deliverability)) {
    return "undeliverable";
  }
  if (isCmraVerification(input)) return "cmra";
  if ((input.peerCount ?? 0) >= POSTCARD_ADDRESS_SHARED_PEER_THRESHOLD) {
    return "shared";
  }
  const record = String(input.recordType ?? "").trim().toLowerCase();
  if (record === "po_box") return "po_box";
  const addrType = String(input.addressType ?? "").trim().toLowerCase();
  if (addrType === "commercial" || record === "firm") return "commercial";
  if (addrType === "residential" || record === "rural_route") {
    return "residential";
  }
  return "unknown";
}

export function postcardAddressKindPatch(input: {
  kind: PostcardAddressKind;
  recordType?: string | null;
  isCmra: boolean;
  peerCount: number;
  checkedAt?: string;
}): {
  postcard_address_kind: PostcardAddressKind;
  postcard_address_record_type: string | null;
  postcard_address_is_cmra: boolean;
  postcard_address_peer_count: number;
  postcard_address_checked_at: string;
} {
  const record = String(input.recordType ?? "").trim();
  return {
    postcard_address_kind: input.kind,
    postcard_address_record_type: record || null,
    postcard_address_is_cmra: input.isCmra,
    postcard_address_peer_count: Math.max(0, input.peerCount),
    postcard_address_checked_at: input.checkedAt ?? new Date().toISOString(),
  };
}
