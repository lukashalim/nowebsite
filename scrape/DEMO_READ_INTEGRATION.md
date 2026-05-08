# Demo Read Integration (Post-Scrape Quality Gate)

Use this checklist after `review_highlights`, `services_offered`, `hours`, and `open_now` have good coverage.

## 1) Data quality gate

- Run [`scrape/sql/businesses-demo-seo-validation.sql`](./sql/businesses-demo-seo-validation.sql).
- Confirm:
  - `with_review_highlights / cohort_total` is high enough for rollout.
  - `services_offered` has meaningful values (not mostly generic duplicates).
  - `hours` and `open_now` are populated for a useful subset.

## 2) Read-path updates

- Extend demo read columns in `src/lib/crm-cohort.ts`:
  - `review_highlights`
  - `services_offered`
  - `hours`
  - `open_now`
- Keep null-safe parsing and no runtime throws on malformed JSON.

## 3) UI rollout order

1. Add `services_offered` bullets to detail page.
2. Add compact `review_highlights` section with short excerpts.
3. Add “Open now” badge + hours table only when valid.
4. Keep existing fallback copy when fields are missing.

## 4) SEO/structured data

- Add optional `Review` entries to JSON-LD from `review_highlights` (short excerpts only).
- Add `openingHoursSpecification` only if normalized hours can be safely mapped.
- Do not expose reviewer PII.

## 5) Guardrails

- Default to excerpts only; avoid rendering full review text blobs.
- Keep legal-safe attribution language for listing-derived snippets.
- Monitor demo page payload size when enabling highlights and hours.
