export interface BusinessLead {
  place_id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  business_type: string | null;
  main_category: string | null;
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  google_maps_link: string | null;
  facebook_url: string | null;
  /** Maps "website" field when stored (e.g. wa.me); may be null for older rows. */
  listing_website: string | null;
  /** Populated when DB has generated column `crm_contact_surface`. */
  crm_contact_surface?: "facebook" | "whatsapp" | "none" | null;
  contact_count: number;
}
