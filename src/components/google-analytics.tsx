import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";

const DIRECTORY_GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-4R9RG4CPG5";

interface GoogleAnalyticsProps {
  /** Override the directory measurement ID (used for client trial sites). */
  gaId?: string;
}

/** GA4 page views. Directory default unless `gaId` is passed. */
export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps = {}) {
  const id = (gaId ?? DIRECTORY_GA_MEASUREMENT_ID).trim();
  if (!id) {
    return null;
  }

  return <NextGoogleAnalytics gaId={id} />;
}
