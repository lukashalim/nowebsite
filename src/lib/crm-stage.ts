export const CRM_STAGE_VALUES = [
  "new",
  "replied",
  "demo_sent",
  "interested",
  "closed",
] as const;

export type CrmStage = (typeof CRM_STAGE_VALUES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  new: "New",
  replied: "Replied",
  demo_sent: "Demo Sent",
  interested: "Interested",
  closed: "Closed",
};

export function isCrmStage(value: string): value is CrmStage {
  return (CRM_STAGE_VALUES as readonly string[]).includes(value);
}
