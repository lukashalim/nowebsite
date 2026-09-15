"use client";

import { useEffect } from "react";
import { sendClientSiteEvent } from "@/lib/analytics";

export function ClientSitePageBeacon({ siteId }: { siteId: string }) {
  useEffect(() => {
    sendClientSiteEvent({ siteId, eventType: "page_view" });
  }, [siteId]);
  return null;
}
