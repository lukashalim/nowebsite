import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-4R9RG4CPG5";

/** GA4 page views — nowebsitebusinessleads.com only (see root layout). */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID.trim()) {
    return null;
  }

  return <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />;
}
