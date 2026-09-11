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

export function trackClickToCall(
  siteId: string,
  linkLocation: ClientSiteCallLocation,
): void {
  trackGaEvent("click_to_call", {
    site_id: siteId,
    link_location: linkLocation,
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
