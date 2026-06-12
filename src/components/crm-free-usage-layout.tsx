"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CrmUsageBanner } from "@/components/crm-usage-banner";
import type { CrmUsageAction, CrmUsageSummary } from "@/lib/crm-limits";

export type CrmOutreachRecordedHandler = (
  remaining: number | null,
  action: CrmUsageAction,
) => void;

const CrmOutreachContext = createContext<CrmOutreachRecordedHandler | undefined>(
  undefined,
);

export function useCrmOutreachRecorded(): CrmOutreachRecordedHandler | undefined {
  return useContext(CrmOutreachContext);
}

interface CrmFreeUsageLayoutProps {
  initialUsage: CrmUsageSummary;
  limitReached?: boolean;
  children: ReactNode;
}

export function CrmFreeUsageLayout({
  initialUsage,
  limitReached: initialLimitReached = false,
  children,
}: CrmFreeUsageLayoutProps) {
  const [usage, setUsage] = useState(initialUsage);
  const limitReached = initialLimitReached || usage.remaining === 0;

  const onOutreachRecorded: CrmOutreachRecordedHandler = (remaining, action) => {
    if (remaining === null) return;

    setUsage((prev) => ({
      ...prev,
      remaining,
      used: prev.limit - remaining,
      byAction: {
        ...prev.byAction,
        [action]: prev.byAction[action] + 1,
      },
    }));
  };

  return (
    <CrmOutreachContext.Provider value={onOutreachRecorded}>
      <CrmUsageBanner usage={usage} limitReached={limitReached} />
      {children}
    </CrmOutreachContext.Provider>
  );
}
