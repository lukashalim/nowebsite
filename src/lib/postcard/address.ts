import type { LobAddress } from "@/lib/lob";
import { stateToAbbr } from "@/lib/directory/slugs";

/**
 * Parse RETURN_ADDRESS from env.
 * Accepts Lob-style JSON, or a single-line US string:
 *   "Name, 123 Main St, City, ST 12345"
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

  if (!parsed || typeof parsed !== "object") {
    throw new Error("RETURN_ADDRESS JSON must be an object");
  }

  const o = parsed as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  const address_line1 = String(
    o.address_line1 ?? o.line1 ?? o.address ?? "",
  ).trim();
  const address_line2 = String(o.address_line2 ?? o.line2 ?? "").trim();
  const address_city = String(o.address_city ?? o.city ?? "").trim();
  const address_state = String(o.address_state ?? o.state ?? "").trim();
  const address_zip = String(
    o.address_zip ?? o.zip ?? o.postal_code ?? "",
  ).trim();
  const address_country = String(o.address_country ?? o.country ?? "US")
    .trim()
    .toUpperCase();

  if (!name || !address_line1 || !address_city || !address_state || !address_zip) {
    throw new Error(
      "RETURN_ADDRESS is missing required fields (name, address_line1, address_city, address_state, address_zip)",
    );
  }

  return {
    name,
    address_line1,
    ...(address_line2 ? { address_line2 } : {}),
    address_city,
    address_state,
    address_zip,
    address_country: address_country || "US",
  };
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

  if (!name || !address_line1 || !address_city || !address_state || !address_zip) {
    throw new Error("Could not parse RETURN_ADDRESS into a full mailing address");
  }

  return {
    name,
    address_line1,
    address_city,
    address_state: address_state.toUpperCase(),
    address_zip,
    address_country: "US",
  };
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
  ownerName?: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string | null;
}): LobAddress {
  const name =
    input.ownerName?.trim() ||
    input.name?.trim() ||
    "Business Owner";
  const rawState = input.state.trim();
  const abbr = stateToAbbr(rawState);
  return {
    name,
    address_line1: input.address.trim(),
    address_city: input.city.trim(),
    address_state: (abbr ?? rawState).toUpperCase(),
    address_zip: input.postal_code.trim(),
    address_country: (input.country?.trim() || "US").toUpperCase(),
  };
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
