/**
 * Telnyx phone line lookup helpers for scrape scripts (mirrors src/lib/phone-lookup.ts).
 */

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

export function normalizePhoneE164(phone, country = "US") {
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

export function classifyTelnyxLineType(raw) {
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

export function resolveTelnyxApiKey() {
  return (
    process.env.TELNYX_API_KEY?.trim() ||
    process.env.telnyx_api_key?.trim() ||
    null
  );
}

export async function lookupTelnyxPhoneLineType(e164, apiKey) {
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
  });

  let payload = null;
  try {
    payload = await res.json();
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { sleep };
