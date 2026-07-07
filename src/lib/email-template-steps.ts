import {
  buildOutreachMessage,
  defaultSpintaxPreviewOpts,
  type OutreachTokenOpts,
} from "@/lib/outreach-spintax";

export interface EmailContent {
  subject: string;
  body: string;
}

export function buildEmailContent(
  subjectTemplate: string,
  bodyTemplate: string,
  opts: OutreachTokenOpts,
): EmailContent {
  return {
    subject: buildOutreachMessage(subjectTemplate, opts),
    body: buildOutreachMessage(bodyTemplate, opts),
  };
}

export function buildEmailSpintaxPreview(
  subjectTemplate: string,
  bodyTemplate: string,
  overrides?: Partial<OutreachTokenOpts>,
): EmailContent {
  return buildEmailContent(
    subjectTemplate,
    bodyTemplate,
    defaultSpintaxPreviewOpts(overrides),
  );
}
