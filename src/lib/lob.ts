/**
 * Lob API helpers. Callers pass the user's API key from profiles
 * (`lob_api_key` live / `lob_test_api_key` test).
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
  status?: string | null;
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

function requireApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Lob API key is required");
  }
  return key;
}

function lobAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export function isLobTestMode(apiKey: string): boolean {
  return apiKey.trim().startsWith("test_");
}

export function isLobLiveMode(apiKey: string): boolean {
  return apiKey.trim().startsWith("live_");
}

export function lobKeyMode(apiKey: string): "test" | "live" | null {
  const key = apiKey.trim();
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  return null;
}

export function isAcceptableUsDeliverability(
  deliverability: string | null | undefined,
): boolean {
  if (!deliverability) return false;
  return ACCEPTABLE_DELIVERABILITY.has(deliverability);
}

/**
 * Cheap auth check before saving a Lob key (GET /v1/addresses?limit=1).
 * Secret keys only — must start with test_ or live_ (not *_pub).
 */
export async function validateLobApiKey(
  apiKey: string,
): Promise<{ ok: true; mode: "test" | "live" } | { ok: false; error: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, error: "Lob API key is required" };
  }

  const mode = lobKeyMode(key);
  if (!mode) {
    return {
      ok: false,
      error: "Lob secret API key must start with test_ or live_",
    };
  }

  // Publishable keys look like test_pub_… / live_pub_… and cannot create postcards.
  if (key.startsWith("test_pub") || key.startsWith("live_pub")) {
    return {
      ok: false,
      error:
        "Use the Lob secret key (test_… or live_…), not the publishable *_pub key",
    };
  }

  try {
    const res = await fetch("https://api.lob.com/v1/addresses?limit=1", {
      headers: { Authorization: lobAuthHeader(key) },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Lob rejected this API key" };
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const err = json?.error as { message?: string } | undefined;
      return {
        ok: false,
        error:
          err?.message ||
          (typeof json?.message === "string" ? json.message : null) ||
          `Lob validation failed (HTTP ${res.status})`,
      };
    }
    return { ok: true, mode };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach Lob: ${err.message}`
          : "Could not reach Lob",
    };
  }
}

/**
 * Verify + standardize a US address via Lob USAV.
 * @see https://docs.lob.com/#tag/US-Verifications
 */
export async function verifyUsAddress(
  apiKey: string,
  input: {
    primary_line: string;
    secondary_line?: string;
    city: string;
    state: string;
    zip_code: string;
  },
): Promise<LobUsVerificationResult> {
  const key = requireApiKey(apiKey);
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
      Authorization: lobAuthHeader(key),
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

export interface LobPostcardQrCode {
  /** HTTPS URL opened after Lob's scan redirect (our /api/postcard-scan). */
  redirectUrl: string;
  widthIn: string;
  topIn: string;
  leftIn: string;
  pages?: "front" | "back" | "front,back";
}

export async function createLobPostcard(
  apiKey: string,
  input: {
    description: string;
    to: LobAddress;
    from: LobAddress;
    front: string;
    back: string;
    size?: "4x6";
    useType?: "marketing" | "operational";
    qrCode?: LobPostcardQrCode;
  },
): Promise<LobPostcardResult> {
  const key = requireApiKey(apiKey);

  // JSON body avoids form-urlencoded mangling of qr_code.redirect_url (?id=…).
  const payload: Record<string, unknown> = {
    description: input.description,
    size: input.size ?? "4x6",
    use_type: input.useType ?? "marketing",
    front: input.front,
    back: input.back,
    to: lobAddressToApiObject(input.to),
    from: lobAddressToApiObject(input.from),
  };

  if (input.qrCode) {
    const redirect = input.qrCode.redirectUrl.trim();
    if (!/^https:\/\//i.test(redirect)) {
      throw new Error("Lob qr_code.redirect_url must be an https:// URL");
    }
    payload.qr_code = {
      position: "relative",
      redirect_url: redirect,
      width: input.qrCode.widthIn,
      top: input.qrCode.topIn,
      left: input.qrCode.leftIn,
      pages: input.qrCode.pages ?? "back",
    };
  }

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: lobAuthHeader(key),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
    status: typeof json.status === "string" ? json.status : null,
  };
}

function lobAddressToApiObject(addr: LobAddress): Record<string, string> {
  const out: Record<string, string> = {
    name: addr.name,
    address_line1: addr.address_line1,
    address_city: addr.address_city,
    address_state: addr.address_state,
    address_zip: addr.address_zip,
    address_country: addr.address_country?.trim() || "US",
  };
  if (addr.company?.trim()) {
    // Lob rejects to.company/from.company above 40 characters.
    out.company = addr.company.trim().slice(0, 40);
  }
  if (addr.address_line2?.trim()) out.address_line2 = addr.address_line2.trim();
  return out;
}

function formatLobFailureReason(failure: unknown): string | null {
  if (!failure || typeof failure !== "object") return null;
  const fr = failure as {
    remediation?: string;
    errors?: Array<{ message?: string; urls?: string[] }>;
  };
  const parts: string[] = [];
  if (fr.remediation?.trim()) parts.push(fr.remediation.trim());
  for (const err of fr.errors ?? []) {
    if (err.message?.trim()) parts.push(err.message.trim());
    const urls = (err.urls ?? []).filter((u) => u && u !== "N/A");
    if (urls.length) parts.push(`Missing assets: ${urls.join(", ")}`);
  }
  return parts.length ? parts.join(" ") : null;
}

/** Fetch a postcard; regenerates signed asset URLs. */
export async function getLobPostcard(
  apiKey: string,
  id: string,
): Promise<{
  id: string;
  url: string | null;
  status: string | null;
  failureMessage: string | null;
}> {
  const key = requireApiKey(apiKey);
  const res = await fetch(`https://api.lob.com/v1/postcards/${id}`, {
    headers: { Authorization: lobAuthHeader(key) },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(
      err?.message ||
        (typeof json.message === "string" ? json.message : null) ||
        `Lob get postcard error HTTP ${res.status}`,
    );
  }
  return {
    id: String(json.id ?? id),
    url: typeof json.url === "string" ? json.url : null,
    status: typeof json.status === "string" ? json.status : null,
    failureMessage: formatLobFailureReason(json.failure_reason),
  };
}

/** Poll until the proof PDF is actually downloadable (Lob often returns a URL before the asset exists). */
export async function waitForLobPostcardProof(
  apiKey: string,
  id: string,
  opts?: { attempts?: number; delayMs?: number },
): Promise<{
  id: string;
  url: string;
  status: string | null;
}> {
  // Lob can report status=processed with a signed URL that 404s for several seconds.
  const attempts = opts?.attempts ?? 20;
  const delayMs = opts?.delayMs ?? 1500;
  let last = await getLobPostcard(apiKey, id);

  for (let i = 0; i < attempts; i += 1) {
    if (last.status === "failed") {
      throw new Error(
        last.failureMessage ||
          "Lob failed to render the postcard proof (check HTML assets/fonts).",
      );
    }

    if (
      last.url &&
      (last.status === "rendered" ||
        last.status === "processed" ||
        last.status === "ready")
    ) {
      const get = await fetch(last.url).catch(() => null);
      const type = get?.headers.get("content-type") ?? "";
      if (get?.ok && type.includes("pdf")) {
        return { id: last.id, url: last.url, status: last.status };
      }
    }

    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
      last = await getLobPostcard(apiKey, id);
    }
  }

  if (last.status === "failed") {
    throw new Error(
      last.failureMessage ||
        "Lob failed to render the postcard proof (check HTML assets/fonts).",
    );
  }

  throw new Error(
    `Lob proof PDF not ready yet (status=${last.status ?? "unknown"}). Wait a few seconds and open the postcard again from the Lob dashboard, or retry Mail.`,
  );
}
