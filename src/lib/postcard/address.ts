import type { LobAddress } from "@/lib/lob";
import { stateToAbbr } from "@/lib/directory/slugs";

export interface PostcardReturnAddressInput {
  name: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
  /** Shown on postcard back as "Call/text us at …". */
  contact_phone?: string;
}

export type PostcardReturnAddressStored = LobAddress & {
  contact_phone?: string;
};

/**
 * Normalize form/DB fields into a Lob from-address.
 * Returns an error string when required fields are missing.
 */
export function normalizePostcardReturnAddress(
  input: PostcardReturnAddressInput,
): { ok: true; address: PostcardReturnAddressStored } | { ok: false; error: string } {
  const name = input.name.trim();
  const address_line1 = input.address_line1.trim();
  const address_line2 = input.address_line2?.trim() || "";
  const address_city = input.address_city.trim();
  const rawState = input.address_state.trim();
  const address_state = (stateToAbbr(rawState) ?? rawState).toUpperCase();
  const address_zip = input.address_zip.trim();
  const address_country = (input.address_country?.trim() || "US").toUpperCase();
  const contact_phone = input.contact_phone?.trim() || "";

  if (!name || !address_line1 || !address_city || !address_state || !address_zip) {
    return {
      ok: false,
      error: "Return address needs name, street, city, state, and ZIP",
    };
  }
  if (address_state.length !== 2) {
    return { ok: false, error: "State must be a 2-letter abbreviation" };
  }
  if (!/^\d{5}(-\d{4})?$/.test(address_zip)) {
    return { ok: false, error: "ZIP must be ##### or #####-####" };
  }

  return {
    ok: true,
    address: {
      name,
      address_line1,
      ...(address_line2 ? { address_line2 } : {}),
      address_city,
      address_state,
      address_zip,
      address_country,
      ...(contact_phone ? { contact_phone } : {}),
    },
  };
}

export function postcardReturnAddressFromUnknown(
  value: unknown,
): PostcardReturnAddressStored | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const parsed = normalizePostcardReturnAddress({
    name: String(o.name ?? ""),
    address_line1: String(o.address_line1 ?? o.line1 ?? o.address ?? ""),
    address_line2: String(o.address_line2 ?? o.line2 ?? ""),
    address_city: String(o.address_city ?? o.city ?? ""),
    address_state: String(o.address_state ?? o.state ?? ""),
    address_zip: String(o.address_zip ?? o.zip ?? o.postal_code ?? ""),
    address_country: String(o.address_country ?? o.country ?? "US"),
    contact_phone: String(o.contact_phone ?? o.phone ?? ""),
  });
  return parsed.ok ? parsed.address : null;
}

/** Lob "from" address without non-Lob fields like contact_phone. */
export function toLobFromAddress(
  stored: PostcardReturnAddressStored,
): LobAddress {
  return {
    name: stored.name,
    address_line1: stored.address_line1,
    ...(stored.address_line2 ? { address_line2: stored.address_line2 } : {}),
    address_city: stored.address_city,
    address_state: stored.address_state,
    address_zip: stored.address_zip,
    address_country: stored.address_country ?? "US",
  };
}

/**
 * @deprecated Prefer per-user postcard_return_address on profiles.
 * Parse RETURN_ADDRESS from env (legacy).
 */
export function parseReturnAddressFromEnv(): LobAddress {
  const raw = process.env.RETURN_ADDRESS?.trim();
  if (!raw) {
    throw new Error("RETURN_ADDRESS is not set in the environment");
  }

  if (raw.startsWith("{")) {
    return parseReturnAddressJson(raw);
  }

  return parseReturnAddressCsvLine(raw);
}

function parseReturnAddressJson(raw: string): LobAddress {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "RETURN_ADDRESS JSON is invalid. Use {\"name\",\"address_line1\",\"address_city\",\"address_state\",\"address_zip\"}",
    );
  }

  const address = postcardReturnAddressFromUnknown(parsed);
  if (!address) {
    throw new Error(
      "RETURN_ADDRESS is missing required fields (name, address_line1, address_city, address_state, address_zip)",
    );
  }
  return address;
}

/** "Name, street, City, ST ZIP" or "Name, street, City, ST, ZIP" */
function parseReturnAddressCsvLine(raw: string): LobAddress {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 4) {
    throw new Error(
      'RETURN_ADDRESS must be JSON or "Name, street, City, ST ZIP"',
    );
  }

  const name = parts[0];
  const last = parts[parts.length - 1];
  const zipOnly = /^\d{5}(-\d{4})?$/.test(last);

  let address_state: string;
  let address_zip: string;
  let cityIdx: number;

  if (zipOnly && parts.length >= 5) {
    address_zip = last;
    address_state = parts[parts.length - 2];
    cityIdx = parts.length - 3;
  } else {
    const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (!stateZip) {
      throw new Error(
        'RETURN_ADDRESS trailing segment must be "ST ZIP" or separate ST, ZIP',
      );
    }
    address_state = stateZip[1].toUpperCase();
    address_zip = stateZip[2];
    cityIdx = parts.length - 2;
  }

  const address_city = parts[cityIdx];
  const streetParts = parts.slice(1, cityIdx);
  const address_line1 = streetParts.join(", ").trim();

  const normalized = normalizePostcardReturnAddress({
    name,
    address_line1,
    address_city,
    address_state,
    address_zip,
  });
  if (!normalized.ok) {
    throw new Error("Could not parse RETURN_ADDRESS into a full mailing address");
  }
  return normalized.address;
}

export function isMailableLeadAddress(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): boolean {
  const line1 = input.address?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  const zip = input.postal_code?.trim() ?? "";
  if (!line1 || !city || !state || !zip) return false;
  return line1.length >= 3 && zip.length >= 5;
}

export function leadToLobAddress(input: {
  name?: string | null;
  /** Optional Lob-safe shortened company label (maximum 40 chars). */
  companyName?: string | null;
  ownerName?: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string | null;
  address_line2?: string | null;
}): LobAddress {
  const business = input.name?.trim() || "";
  const company = input.companyName?.trim() || business;
  const owner = input.ownerName?.trim() || "";
  const rawState = input.state.trim();
  const abbr = stateToAbbr(rawState);
  const line2 = input.address_line2?.trim() || "";

  const base = {
    address_line1: input.address.trim(),
    ...(line2 ? { address_line2: line2 } : {}),
    address_city: input.city.trim(),
    address_state: (abbr ?? rawState).toUpperCase(),
    address_zip: input.postal_code.trim(),
    address_country: (input.country?.trim() || "US").toUpperCase(),
  };

  if (owner && business) {
    return { name: owner, company, ...base };
  }
  if (owner) {
    return { name: owner, ...base };
  }
  if (business) {
    return { name: business, ...base };
  }
  return { name: "Business Owner", ...base };
}

export function formatLeadAddressLines(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string[] {
  const lines: string[] = [];
  if (input.address?.trim()) lines.push(input.address.trim());
  const cityStateZip = [
    input.city?.trim(),
    [input.state?.trim(), input.postal_code?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) lines.push(cityStateZip);
  return lines;
}
