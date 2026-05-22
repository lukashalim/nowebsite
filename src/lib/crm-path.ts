import type { CrmSearchParams } from "@/lib/crm-params";
import { buildCrmQueryString } from "@/lib/crm-params";

export const CRM_BASE_PATH = "/crm";

export function crmPath(params?: CrmSearchParams): string {
  if (!params) return CRM_BASE_PATH;
  const qs = buildCrmQueryString(params);
  return `${CRM_BASE_PATH}${qs}`;
}
