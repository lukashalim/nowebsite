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
