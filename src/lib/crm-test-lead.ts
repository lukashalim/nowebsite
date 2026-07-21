/** True when a lead is marked test and the caller did not opt in via allowTest. */
export function shouldBlockTestLead(
  isTest: unknown,
  allowTest: boolean | undefined | null,
): boolean {
  return isTest === true && allowTest !== true;
}

export const TEST_LEAD_BLOCKED_MESSAGE =
  "This is a test lead. Turn on “Show test leads” in CRM to use it for outreach.";
