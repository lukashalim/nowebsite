import { z } from "zod";

const socialEntrySchema = z
  .object({
    url: z.string().optional(),
    link: z.string().optional(),
    href: z.string().optional(),
    type: z.string().optional(),
    label: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const contactEnrichmentSchema = z
  .object({
    sales_summary: z.string().optional(),
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    facebook: z.string().optional(),
    email: z.string().optional(),
    emails: z.union([z.string(), z.array(z.string())]).optional(),
    emails_and_social: z
      .union([
        z.array(socialEntrySchema),
        z.array(z.string()),
        z.record(z.string(), z.unknown()),
      ])
      .optional(),
  })
  .passthrough();

export type ContactEnrichment = z.infer<typeof contactEnrichmentSchema>;

export function parseContactEnrichment(
  raw: unknown,
): ContactEnrichment | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = contactEnrichmentSchema.safeParse(raw);
  return r.success ? r.data : null;
}
