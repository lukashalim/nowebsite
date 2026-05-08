/** Side-effect import: default scrape_jobs + businesses table for nowebsite pipeline. */
if (!process.env.SCRAPE_JOBS_TABLE?.trim()) {
  process.env.SCRAPE_JOBS_TABLE = "scrape_jobs_nowebsite";
}
if (!process.env.BUSINESSES_TABLE?.trim()) {
  process.env.BUSINESSES_TABLE = "businesses_nowebsite";
}

/** Needed for review_highlights / demo carousel (see buildGoogleMapsDispatchData). */
if (
  process.env.ENABLE_REVIEWS_EXTRACTION === undefined ||
  process.env.ENABLE_REVIEWS_EXTRACTION === ""
) {
  process.env.ENABLE_REVIEWS_EXTRACTION = "1";
}
