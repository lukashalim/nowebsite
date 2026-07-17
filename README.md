# No Website Business Leads

The prospecting CRM for web designers and agencies.

Find, pitch, and close local businesses that don't have a website — or worse, have Facebook listed as their Google Maps website link.

**Live:** [nowebsitebusinessleads.com](https://nowebsitebusinessleads.com)

## What It Does

No Website Business Leads aggregates public Google Business data to surface local businesses operating without a dedicated website, organized by city and category. The platform pairs a searchable directory with **Outreach Engine**, an outreach-focused CRM so designers can manage their pipeline and launch cold outreach from a single dashboard.

A common high-converting target: businesses using **Facebook as their website** on Google Maps. That setup hurts mobile conversions and conflicts with how Google expects listings to be structured.

## Key Features

- **Lead directory** — verified no-website businesses across US cities, browsable by city and category
- **Facebook filter** — surface businesses using Facebook as their primary website link
- **Outreach Engine CRM** — auth-gated dashboard with contact stage tracking, owner notes, and outreach history
- **One-click outreach** — cold call, SMS (with Twilio line-type check), and Facebook DM from the CRM with pre-generated spintax openers
- **Spintax templates** — editable Facebook DM and SMS templates by lead type (Facebook listing vs no Facebook)
- **Demo page builder** — live mobile preview sites via [ringreadysite.com](https://ringreadysite.com) for cold outreach pitches
- **CSV export** — download lead lists by city and category

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Database | Supabase (Postgres) |
| Auth | Google OAuth via Supabase |
| Hosting | Vercel |

## Project Structure

```
src/          # Next.js app — pages, components, API routes
src/app/crm/  # Outreach Engine CRM (leads, spintax editor)
scrape/       # Google Business Profile scraping pipeline
public/       # Static assets
```

## Local Development

1. Copy `.env.local.example` to `.env.local` and fill in Supabase credentials.
2. Optional: add `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` for platform SMS line-type lookup in the CRM.
3. Optional: configure **Pro communications** in Settings (`/dashboard/settings`) with your own Twilio Account SID, Auth Token, business phone number, and forwarding number. When saved, CRM call/SMS use your Twilio line; otherwise they fall back to native `tel:` / `sms:` links.
4. Optional: add `TELNYX_API_KEY` for batch phone-type enrichment (see below).
5. Set `NEXT_PUBLIC_SITE_URL` in production so Twilio voice webhooks resolve correctly.
6. Run SQL migrations in `scrape/sql/` against your Supabase project as needed.
7. Start the dev server:

```bash
npm install
npm run dev
```

Sign in at `/sign-in` or `/crm` with Google OAuth. Configure Supabase **Site URL** and **Redirect URLs** for your environment (e.g. `https://nowebsitebusinessleads.com/auth/callback` in production).

### Phone line type backfill (Telnyx)

Home-services businesses can be enriched with carrier line type (`mobile`, `landline_or_voip`, `unknown`) for CRM filtering.

1. Run [`scrape/sql/add-phone-line-type.sql`](scrape/sql/add-phone-line-type.sql) in Supabase.
2. Set `TELNYX_API_KEY` in `.env.local` (Telnyx Mission Control → API Keys).
3. Dry run, then backfill:

```bash
node --import ./scrape/env-nowebsite-queue.mjs ./scrape/backfill-phone-line-type.mjs --dry-run --limit 20
node --import ./scrape/env-nowebsite-queue.mjs ./scrape/backfill-phone-line-type.mjs --limit 500
node --import ./scrape/env-nowebsite-queue.mjs ./scrape/backfill-phone-line-type.mjs --states=Maryland,"District Of Columbia"
```

Use `--force` to re-lookup rows that already have `phone_line_type`. Optional env: `PHONE_LINE_BACKFILL_BATCH` (default 25), `PHONE_LINE_BACKFILL_SLEEP_MS` (default 300), `PHONE_LINE_BACKFILL_STATES` (comma-separated state names).

### CRM Lob postcards (Mail channel)

CRM **Outreach** column: **Call | Text | Mail**. Mail sends a Lob 4×6 postcard:

- **Front:** HTML built from listing data (name, category, location, rating, review quote)
- **Back:** pitch + QR → live RingReady demo
- **To address:** owner first name (auto-Suggest from reviews if not saved yet) + business as Lob `company` when both exist; otherwise business name alone
- **`use_type`:** always `marketing`

Lob US address verification runs before create; undeliverable addresses return a clear 422. For scraped Google addresses, set Lob account deliverability strictness to **Normal** (or **Relaxed** for test keys) at [Account settings](https://dashboard.lob.com/#/settings/account).

Env (`.env.local`):

```bash
LOB_SECRET_KEY=test_...   # or LOB_API_KEY; test_ keys never mail physically
RETURN_ADDRESS={"name":"...","address_line1":"...","address_city":"...","address_state":"XX","address_zip":"#####"}
# or comma form: Name, 123 Main St, City, ST 12345
```

Also run [`scrape/sql/add-postcard-sent-usage.sql`](scrape/sql/add-postcard-sent-usage.sql) if not already applied (adds `postcard_sent` to free-tier outreach usage).

### Postcard demo screenshots (optional)

Optional batch-capture of personalized RingReady demos as 1275×1875 JPGs (legacy / creative experiments). CRM Mail does **not** require these.

```bash
npm run postcard:screenshots -- --username=YOURCRMUSER --origin=http://localhost:3001 --limit 20
```

Flags: `--dry-run`, `--local-only`, `--force`, `--format=png`, `--place-id=`, `--states=Maryland`. Env: `POSTCARD_DEMO_ORIGIN`, `POSTCARD_SCREENSHOT_BATCH`, `POSTCARD_SCREENSHOT_SLEEP_MS`, `POSTCARD_SCREENSHOT_STATES`.

## Related

- [ringreadysite.com](https://ringreadysite.com) — companion tool that generates demo websites from Google Maps data for use during cold outreach

## Contact

Built by Lukas Halim — [lukas@nowebsitebusinessleads.com](mailto:lukas@nowebsitebusinessleads.com)
