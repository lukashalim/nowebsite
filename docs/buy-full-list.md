# Buy full list ($9 Embedded Checkout)

One-time purchase that delivers the **remaining** directory CSV rows after the free 100-row page.

## Env vars

Add to `.env.local` and Vercel:

```bash
# Existing Stripe keys (already used for Pro)
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Pro CRM subscription ($27/month)
STRIPE_CRM_PRO_PRICE_ID=price_...

# One-time $9 CSV Price ID (Products → Add product → One time $9)
STRIPE_CSV_PRICE_ID=price_...
```

## Database / storage

Run (or confirm applied):

- [`scrape/sql/create-list-purchases.sql`](../scrape/sql/create-list-purchases.sql)
  - Table `list_purchases`
  - Private Storage bucket `list-purchase-csvs`

## Email fallback (Resend)

After CSV fulfillment, the buyer receives a transactional email:

- From: `No-Website Business Leads <leads@mail.botsbridge.com>`
- To: Checkout Session `customer_details.email` (required by Checkout)
- Attachment if CSV ≤ ~5MB; otherwise a ~48h Supabase signed download link
- Failures are **logged only** — purchase stays fulfilled; browser download still works

Env:

```bash
RESEND_API_KEY=re_...
```

Subject/body use an adaptive scope label (`dentists`, `Austin, TX`, or `dentists in Austin, TX`).

## Local webhook testing

1. Start the Next.js app (`npm run dev`).
2. In another terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Copy the CLI webhook signing secret (`whsec_...`) into local `STRIPE_WEBHOOK_SECRET` and restart the app (CLI secret differs from Dashboard).
4. On a category or city page with more than 100 listings, open **Download CSV → Remaining … — $9**.
5. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. Confirm:
   - Modal polls and the remaining CSV downloads
   - `list_purchases` row is `fulfilled`
   - Object exists under Storage bucket `list-purchase-csvs`

Optional: trigger events with `stripe trigger checkout.session.completed` (metadata will not match a real list purchase — prefer a real Embedded Checkout test).

## Production webhook

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://nowebsitebusinessleads.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Put the endpoint signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`

The same webhook handles Pro subscriptions and `$9` full-list purchases (`metadata.purchase_type=full_list`).
