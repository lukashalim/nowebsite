type GtagFn = (
  command: "event",
  eventName: string,
  params?: Record<string, string>,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

/** Fire a GA4 event via gtag when available. Never throws; never delays navigation. */
export function trackGaEvent(
  eventName: string,
  params?: Record<string, string>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", eventName, params);
  } catch {
    // Analytics must never break UX
  }
}

export function trackCsvPurchaseClick(
  categoryOrCity: string,
  clickLocation: "top" | "bottom",
): void {
  trackGaEvent("csv_purchase_click", {
    category_or_city: categoryOrCity,
    click_location: clickLocation,
  });
}

export type ClientSiteCallLocation = "header" | "hero" | "contact";

export type ClientSiteEventType = "page_view" | "click_to_call";

/** Best-effort first-party event. Never throws; never delays navigation. */
export function sendClientSiteEvent(input: {
  siteId: string;
  eventType: ClientSiteEventType;
  linkLocation?: ClientSiteCallLocation;
}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      siteId: input.siteId,
      eventType: input.eventType,
      ...(input.linkLocation ? { linkLocation: input.linkLocation } : {}),
    });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/client-site-event", blob)) return;
    void fetch("/api/client-site-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never break UX
  }
}

export function trackClickToCall(
  siteId: string,
  linkLocation: ClientSiteCallLocation,
): void {
  trackGaEvent("click_to_call", {
    site_id: siteId,
    link_location: linkLocation,
  });
  sendClientSiteEvent({
    siteId,
    eventType: "click_to_call",
    linkLocation,
  });
}

export function trackOutboundClick(
  siteId: string,
  label: string,
  linkLocation: string,
): void {
  trackGaEvent("outbound_click", {
    site_id: siteId,
    link_label: label,
    link_location: linkLocation,
  });
}
