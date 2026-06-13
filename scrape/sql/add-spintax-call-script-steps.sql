-- Add Hook/Pivot/Offer script steps for call-channel spintax templates.
-- `template` remains the Hook step; pivot_template and offer_template are Pivot and Offer.
-- Run in Supabase SQL editor (replay-safe).

alter table public.spintax_templates
  add column if not exists pivot_template text,
  add column if not exists offer_template text;

comment on column public.spintax_templates.pivot_template is
  'Call script Pivot step (channel = call). Nullable for sms/facebook.';
comment on column public.spintax_templates.offer_template is
  'Call script Offer step (channel = call). Nullable for sms/facebook.';

-- Backfill existing call templates by name (matches default seed names).
update public.spintax_templates
set
  pivot_template = '{When someone taps Website on Google from their phone, they land on Facebook instead of a page where they can call you right away. A lot of people just bounce and call the next listing.}',
  offer_template = '{I put together a quick demo showing what a proper site looks like for your listing. Mind if I text you the link?|I made a short preview of what yours could look like. OK if I send it over?}'
where channel = 'call'
  and pivot_template is null
  and name = 'Call — Mobile friction';

update public.spintax_templates
set
  pivot_template = '{Your Google listing is missing a website link. When mobile searchers check listings, many skip businesses without a fast page to see services and hours.}',
  offer_template = '{I put together a quick demo of what a simple site could look like for you. Mind if I text you the link?|I made a short preview you can check on your phone. OK if I send it?}'
where channel = 'call'
  and pivot_template is null
  and name = 'Call — No website';

update public.spintax_templates
set
  pivot_template = '{It is a small thing on your Google listing that can quietly cost you calls from people searching on their phone.}',
  offer_template = '{I can show you exactly what I mean with a quick demo link. Mind if I text it to you?|Want me to send a short link so you can see it?}'
where channel = 'call'
  and pivot_template is null
  and name = 'Call — Mystery hook';

-- Fallback for any other call templates still missing steps.
update public.spintax_templates
set
  pivot_template = coalesce(
    pivot_template,
    'When mobile searchers tap through Google listings, businesses without a clear website link often get skipped.'
  ),
  offer_template = coalesce(
    offer_template,
    'I put together a quick demo for your listing. Mind if I text you the link?'
  )
where channel = 'call'
  and (pivot_template is null or offer_template is null);
