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
  contact_count: number;
}
