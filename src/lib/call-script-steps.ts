import {
  buildOutreachMessage,
  type OutreachTokenOpts,
} from "@/lib/outreach-spintax";

export interface CallScriptSteps {
  hook: string;
  pivot: string;
  offer: string;
}

export function buildCallScriptSteps(
  hookTemplate: string,
  pivotTemplate: string,
  offerTemplate: string,
  opts: OutreachTokenOpts,
): CallScriptSteps {
  return {
    hook: buildOutreachMessage(hookTemplate, opts),
    pivot: buildOutreachMessage(pivotTemplate, opts),
    offer: buildOutreachMessage(offerTemplate, opts),
  };
}
