/**
 * Lob API helpers (platform key from env).
 * Prefer LOB_SECRET_KEY (Lob dashboard); LOB_API_KEY accepted as alias.
 */

export interface LobAddress {
  name: string;
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

export function isLobTestMode(): boolean {
  try {
    return resolveLobApiKey().startsWith("test_");
  } catch {
    return true;
  }
}

export async function createLobPostcard(input: {
  description: string;
  to: LobAddress;
  from: LobAddress;
  front: string;
  back: string;
  size?: "4x6";
}): Promise<LobPostcardResult> {
  const apiKey = resolveLobApiKey();
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  const body = new URLSearchParams();
  body.set("description", input.description);
  body.set("size", input.size ?? "4x6");
  body.set("front", input.front);
  body.set("back", input.back);

  const setAddress = (prefix: "to" | "from", addr: LobAddress) => {
    body.set(`${prefix}[name]`, addr.name);
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
      Authorization: `Basic ${auth}`,
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
