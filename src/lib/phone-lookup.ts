export type PhoneCountry = "US" | "GB" | "AU";

export type PhoneLineClassification = "mobile" | "landline_or_voip" | "unknown";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhoneE164(
  phone: string,
  country: PhoneCountry | null | undefined = "US",
): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed.slice(1));
    return digits ? `+${digits}` : null;
  }

  const digits = digitsOnly(trimmed);
  if (!digits) return null;

  const resolvedCountry = country ?? "US";

  if (resolvedCountry === "US") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (digits.length >= 11) return `+${digits}`;
    return null;
  }

  if (resolvedCountry === "GB") {
    const national = digits.replace(/^0+/, "");
    if (national.length >= 9 && national.length <= 11) return `+44${national}`;
    return null;
  }

  if (resolvedCountry === "AU") {
    const national = digits.replace(/^0+/, "");
    if (national.length >= 8 && national.length <= 10) return `+61${national}`;
    return null;
  }

  return null;
}

export function classifyTwilioLineType(
  type: string | null | undefined,
): PhoneLineClassification {
  if (type === "mobile") return "mobile";
  if (type === "landline" || type === "fixedVoip" || type === "nonFixedVoip") {
    return "landline_or_voip";
  }
  return "unknown";
}

export function classifyTelnyxLineType(
  raw: string | null | undefined,
): PhoneLineClassification {
  const type = raw?.trim().toLowerCase();
  if (type === "mobile") return "mobile";
  if (
    type === "fixed line" ||
    type === "voip" ||
    type === "fixed line or mobile"
  ) {
    return "landline_or_voip";
  }
  return "unknown";
}

export interface TelnyxPhoneLineLookupSuccess {
  ok: true;
  classification: PhoneLineClassification;
  rawType: string | null;
  checkedAt: string;
  httpStatus: number;
}

export interface TelnyxPhoneLineLookupFailure {
  ok: false;
  httpStatus: number;
  errorDetail: string;
  checkedAt: string;
}

export type TelnyxPhoneLineLookupResult =
  | TelnyxPhoneLineLookupSuccess
  | TelnyxPhoneLineLookupFailure;

interface TelnyxErrorPayload {
  errors?: Array<{ title?: string; detail?: string }>;
}

interface TelnyxCarrier {
  type?: string | null;
}

interface TelnyxPortability {
  line_type?: string | null;
}

interface TelnyxLookupResponse {
  data?: {
    carrier?: TelnyxCarrier | null;
    portability?: TelnyxPortability | null;
  };
}

export function resolveTelnyxApiKey(): string | null {
  return (
    process.env.TELNYX_API_KEY?.trim() ||
    process.env.telnyx_api_key?.trim() ||
    null
  );
}

export async function lookupTelnyxPhoneLineType(
  e164: string,
  apiKey: string,
): Promise<TelnyxPhoneLineLookupResult> {
  const checkedAt = new Date().toISOString();
  const lookupUrl = new URL(
    `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(e164)}`,
  );
  lookupUrl.searchParams.set("type", "carrier");

  const res = await fetch(lookupUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  let payload: TelnyxLookupResponse & TelnyxErrorPayload | null = null;
  try {
    payload = (await res.json()) as TelnyxLookupResponse & TelnyxErrorPayload;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const detail =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.title ||
      `HTTP ${res.status}`;
    return {
      ok: false,
      httpStatus: res.status,
      errorDetail: detail,
      checkedAt,
    };
  }

  const rawType =
    payload?.data?.carrier?.type?.trim() ||
    payload?.data?.portability?.line_type?.trim() ||
    null;

  return {
    ok: true,
    classification: classifyTelnyxLineType(rawType),
    rawType,
    checkedAt,
    httpStatus: res.status,
  };
}
