import type { AngiCompetitor } from "@/lib/angi-listing";
import type { CrmStage } from "@/lib/crm-stage";
import type { PostcardAddressKind } from "@/lib/postcard/address-kind";

export interface BusinessLead {
  place_id: string;
  /** Pretty `/demo/{slug}` segment when set (see scrape `demo_slug`). */
  demo_slug?: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country?: "US" | "GB" | "AU" | null;
  business_type: string | null;
  main_category: string | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  /** Telnyx carrier lookup bucket (home-services backfill). */
  phone_line_type?: "mobile" | "landline_or_voip" | "unknown" | null;
  /** Lob USAV + occupancy bucket for the Maps street (postcard send). */
  postcard_address_kind?: PostcardAddressKind | null;
  /** DataForSEO SERP Angi/HomeAdvisor listing detection. */
  has_angi_listing?: boolean | null;
  angi_listing_url?: string | null;
  angi_listing_title?: string | null;
  angi_listing_confidence?: number | null;
  angi_competitors?: AngiCompetitor[] | null;
  angi_listing_checked_at?: string | null;
  /** Owner first name from Angi About us scrape. */
  angi_owner_name?: string | null;
  google_maps_link: string | null;
  facebook_url: string | null;
  /** Maps "website" field when stored (e.g. wa.me); may be null for older rows. */
  listing_website: string | null;
  /** Populated when DB has generated column `crm_contact_surface`. */
  crm_contact_surface?: "facebook" | "whatsapp" | "none" | null;
  contact_count: number;
  stage: CrmStage;
  owner_name: string | null;
  notes: string | null;
  contact_email: string | null;
  enrichment_email: string | null;
  /** Internal QA/test lead; shown only when CRM `showTestLeads` is on. */
  is_test?: boolean;
}
