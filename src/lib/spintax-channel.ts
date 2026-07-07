import type { SpintaxTemplate } from "@/lib/spintax-templates";

export const SPINTAX_CHANNEL_VALUES = ["facebook", "sms", "call", "email"] as const;

export type SpintaxChannel = (typeof SPINTAX_CHANNEL_VALUES)[number];

export const SPINTAX_CHANNEL_LABELS: Record<SpintaxChannel, string> = {
  facebook: "Facebook DM",
  sms: "SMS",
  call: "Call script",
  email: "Email",
};

export function isSpintaxChannel(value: string): value is SpintaxChannel {
  return (SPINTAX_CHANNEL_VALUES as readonly string[]).includes(value);
}

export function filterSpintaxTemplatesByChannel(
  templates: SpintaxTemplate[],
  channel: SpintaxChannel,
): SpintaxTemplate[] {
  return templates.filter((t) => t.channel === channel);
}
