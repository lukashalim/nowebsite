/**
 * Lob API helpers (platform key from env).
 * Prefer LOB_SECRET_KEY (Lob dashboard); LOB_API_KEY accepted as alias.
 */

export interface LobAddress {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
}

export interface LobPostcardResult {
  id: string;
  url: string | null;
  expected_delivery_date: string | null;
}

export type LobUsDeliverability =
  | "deliverable"
  | "deliverable_unnecessary_unit"
  | "deliverable_incorrect_unit"
  | "deliverable_missing_unit"
  | "deliverable_empty_unit"
  | "undeliverable"
  | string;

export interface LobUsVerificationResult {
  deliverability: LobUsDeliverability;
  primary_line: string;
  secondary_line: string | null;
  city: string;
  state: string;
  zip_code: string;
}

/** Values accepted under Lob "Normal" (and Strict's deliverable-only subset). */
const ACCEPTABLE_DELIVERABILITY = new Set([
  "deliverable",
  "deliverable_unnecessary_unit",
  "deliverable_incorrect_unit",
  "deliverable_missing_unit",
  "deliverable_empty_unit",
]);

function resolveLobApiKey(): string {
  const key =
    process.env.LOB_SECRET_KEY?.trim() ||
    process.env.LOB_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "LOB_SECRET_KEY (or LOB_API_KEY) is not set in the environment",
    );
  }
  return key;
}

function lobAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export function isLobTestMode(): boolean {
  try {
    return resolveLobApiKey().startsWith("test_");
  } catch {
    return true;
  }
}

export function isAcceptableUsDeliverability(
  deliverability: string | null | undefined,
): boolean {
  if (!deliverability) return false;
  return ACCEPTABLE_DELIVERABILITY.has(deliverability);
}

/**
 * Verify + standardize a US address via Lob USAV.
 * @see https://docs.lob.com/#tag/US-Verifications
 */
export async function verifyUsAddress(input: {
  primary_line: string;
  secondary_line?: string;
  city: string;
  state: string;
  zip_code: string;
}): Promise<LobUsVerificationResult> {
  const apiKey = resolveLobApiKey();
  const body = new URLSearchParams();
  body.set("primary_line", input.primary_line.trim());
  if (input.secondary_line?.trim()) {
    body.set("secondary_line", input.secondary_line.trim());
  }
  body.set("city", input.city.trim());
  body.set("state", input.state.trim());
  body.set("zip_code", input.zip_code.trim());

  const res = await fetch("https://api.lob.com/v1/us_verifications", {
    method: "POST",
    headers: {
      Authorization: lobAuthHeader(apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(
      err?.message ||
        (typeof json.message === "string" ? json.message : null) ||
        `Lob US verification error HTTP ${res.status}`,
    );
  }

  const components = (json.components ?? {}) as Record<string, unknown>;
  const primary =
    typeof json.primary_line === "string" ? json.primary_line.trim() : "";
  const secondary =
    typeof json.secondary_line === "string" && json.secondary_line.trim()
      ? json.secondary_line.trim()
      : null;
  const city =
    (typeof components.city === "string" && components.city.trim()) ||
    (typeof json.city === "string" && json.city.trim()) ||
    input.city.trim();
  const state =
    (typeof components.state === "string" && components.state.trim()) ||
    (typeof json.state === "string" && json.state.trim()) ||
    input.state.trim();
  const zip =
    (typeof components.zip_code === "string" && components.zip_code.trim()) ||
    (typeof json.zip_code === "string" && json.zip_code.trim()) ||
    input.zip_code.trim();

  return {
    deliverability: String(json.deliverability ?? "undeliverable"),
    primary_line: primary || input.primary_line.trim(),
    secondary_line: secondary,
    city,
    state,
    zip_code: zip,
  };
}

export async function createLobPostcard(input: {
  description: string;
  to: LobAddress;
  from: LobAddress;
  front: string;
  back: string;
  size?: "4x6";
  useType?: "marketing" | "operational";
}): Promise<LobPostcardResult> {
  const apiKey = resolveLobApiKey();

  const body = new URLSearchParams();
  body.set("description", input.description);
  body.set("size", input.size ?? "4x6");
  body.set("use_type", input.useType ?? "marketing");
  body.set("front", input.front);
  body.set("back", input.back);

  const setAddress = (prefix: "to" | "from", addr: LobAddress) => {
    body.set(`${prefix}[name]`, addr.name);
    if (addr.company?.trim()) {
      body.set(`${prefix}[company]`, addr.company.trim());
    }
    body.set(`${prefix}[address_line1]`, addr.address_line1);
    if (addr.address_line2) {
      body.set(`${prefix}[address_line2]`, addr.address_line2);
    }
    body.set(`${prefix}[address_city]`, addr.address_city);
    body.set(`${prefix}[address_state]`, addr.address_state);
    body.set(`${prefix}[address_zip]`, addr.address_zip);
    body.set(
      `${prefix}[address_country]`,
      addr.address_country?.trim() || "US",
    );
  };
  setAddress("to", input.to);
  setAddress("from", input.from);

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: lobAuthHeader(apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(
      err?.message ||
        (typeof json.message === "string" ? json.message : null) ||
        `Lob API error HTTP ${res.status}`,
    );
  }

  return {
    id: String(json.id ?? ""),
    url: typeof json.url === "string" ? json.url : null,
    expected_delivery_date:
      typeof json.expected_delivery_date === "string"
        ? json.expected_delivery_date
        : null,
  };
}
