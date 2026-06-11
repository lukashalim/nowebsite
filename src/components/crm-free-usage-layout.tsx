"use client";

import { useState, type ReactNode } from "react";
import { CrmUsageBanner } from "@/components/crm-usage-banner";
import type { CrmUsageAction, CrmUsageSummary } from "@/lib/crm-limits";

export type CrmOutreachRecordedHandler = (
  remaining: number | null,
  action: CrmUsageAction,
) => void;

interface CrmFreeUsageLayoutProps {
  initialUsage: CrmUsageSummary;
  limitReached?: boolean;
  children: (onOutreachRecorded: CrmOutreachRecordedHandler) => ReactNode;
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
    <>
      <CrmUsageBanner usage={usage} limitReached={limitReached} />
      {children(onOutreachRecorded)}
    </>
  );
}
