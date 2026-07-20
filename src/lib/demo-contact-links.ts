export const DEMO_CONTACT_EMAIL = "lukas@ringreadysite.com";
export const DEMO_EMAIL_SUBJECT = "Interested in my free website";

/** Encode RFC 3986 reserved punctuation that encodeURIComponent leaves intact. */
export function encodeContactValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildDemoContactBody(businessName: string): string {
  return `Hi, this is ${businessName}. I'd like to get my free website set up and see how it works.`;
}

export function buildDemoEmailHref(businessName: string): string {
  return `mailto:${DEMO_CONTACT_EMAIL}?subject=${encodeContactValue(DEMO_EMAIL_SUBJECT)}&body=${encodeContactValue(buildDemoContactBody(businessName))}`;
}

export function buildDemoSmsHref(
  businessName: string,
  outreachPhone: string,
): string {
  return `sms:${outreachPhone}?&body=${encodeContactValue(buildDemoContactBody(businessName))}`;
}
