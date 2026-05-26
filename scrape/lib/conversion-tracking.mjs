/**
 * Passive conversion detection when re-scrape finds a website on a previously no-website lead.
 */

export const TRACKING_SELECT_COLUMNS =
  "place_id, has_website, listing_website, converted, first_seen_without_website, website_acquired_date, scraped_at, city, state, country, business_type, main_category";

/** GBP fields copied onto the business row when a conversion is recorded. */
export const CONVERSION_BUSINESS_UPDATE_KEYS = [
  "name",
  "address",
  "city",
  "state",
  "country",
  "postal_code",
  "latitude",
  "longitude",
  "main_category",
  "business_type",
  "rating",
  "reviews",
  "phone",
  "google_maps_link",
];

const PREFETCH_CHUNK = 300;

/**
 * @param {string|null|undefined} value
 */
function trimOrNull(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t || null;
}

/**
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DD UTC
 */
export function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string|Date|null|undefined} start
 * @param {string|Date|null|undefined} end
 * @returns {number|null}
 */
export function daysBetween(start, end) {
  if (!start || !end) return null;
  const s = new Date(`${String(start).slice(0, 10)}T00:00:00.000Z`);
  const e = new Date(`${String(end).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.floor((e.getTime() - s.getTime()) / 86400000);
  return Math.max(0, diff);
}

/**
 * @param {{ has_website?: boolean|null, listing_website?: string|null }|null|undefined} row
 * @returns {boolean}
 */
export function hadNoRealWebsite(row) {
  if (!row) return false;
  if (row.has_website === true) return false;
  return !trimOrNull(row.listing_website);
}

/**
 * @param {{ has_website?: boolean|null, listing_website?: string|null }|null|undefined} payload
 * @returns {boolean}
 */
export function hasRealWebsite(payload) {
  return Boolean(payload?.has_website === true && trimOrNull(payload?.listing_website));
}

/**
 * @param {{ existing?: object|null, payload: object, websiteFoundOn: string }} p
 */
export function buildConversionStatRow({ existing, payload, websiteFoundOn }) {
  const firstSeen =
    existing?.first_seen_without_website ??
    (existing?.scraped_at ? utcDateString(new Date(existing.scraped_at)) : websiteFoundOn);

  return {
    place_id: payload.place_id,
    category: trimOrNull(payload.business_type) ?? trimOrNull(payload.main_category),
    website_found_on: websiteFoundOn,
    first_seen_without_website: firstSeen,
    days_to_convert: daysBetween(firstSeen, websiteFoundOn),
    name: payload.name ?? null,
    address: payload.address ?? null,
    city: payload.city ?? null,
    state: payload.state ?? null,
    country: trimOrNull(payload.country) ?? null,
    postal_code: payload.postal_code ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    main_category: payload.main_category ?? null,
    business_type: payload.business_type ?? null,
    rating: payload.rating ?? null,
    reviews: payload.reviews ?? null,
    phone: payload.phone ?? null,
    google_maps_link: payload.google_maps_link ?? null,
    listing_website: trimOrNull(payload.listing_website),
  };
}

/**
 * @param {{ existing?: object|null, payload: object, now?: Date }} p
 * @returns {{ converted: boolean, fields: object, statRow: object|null }}
 */
export function applyTrackingToPayload({ existing, payload, now = new Date() }) {
  const last_checked = now.toISOString();
  /** @type {Record<string, unknown>} */
  const fields = { last_checked };

  if (!hasRealWebsite(payload)) {
    if (!existing) {
      fields.first_seen_without_website = utcDateString(now);
    } else if (!existing.first_seen_without_website) {
      fields.first_seen_without_website = existing.scraped_at
        ? utcDateString(new Date(existing.scraped_at))
        : utcDateString(now);
    }
    return { converted: false, fields, statRow: null };
  }

  fields.has_website = true;
  fields.listing_website = trimOrNull(payload.listing_website);

  if (existing && hadNoRealWebsite(existing) && !existing.converted) {
    const websiteFoundOn = utcDateString(now);
    fields.converted = true;
    fields.website_acquired_date = websiteFoundOn;
    const statRow = buildConversionStatRow({ existing, payload, websiteFoundOn });
    return { converted: true, fields, statRow };
  }

  return { converted: false, fields, statRow: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string[]} placeIds
 * @returns {Promise<Map<string, object>>}
 */
export async function prefetchExistingByPlaceId(supabase, table, placeIds) {
  const map = new Map();
  const unique = [...new Set(placeIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += PREFETCH_CHUNK) {
    const slice = unique.slice(i, i + PREFETCH_CHUNK);
    const { data, error } = await supabase
      .from(table)
      .select(TRACKING_SELECT_COLUMNS)
      .in("place_id", slice);
    if (error) {
      throw new Error(`prefetchExistingByPlaceId: ${error.message}`);
    }
    for (const row of data ?? []) {
      map.set(row.place_id, row);
    }
  }
  return map;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 */
export function createExistingLookup(supabase, table) {
  /** @type {Map<string, object>} */
  const map = new Map();

  return {
    get(placeId) {
      return map.get(placeId) ?? null;
    },
    async prefetch(placeIds) {
      const batch = await prefetchExistingByPlaceId(supabase, table, placeIds);
      for (const [k, v] of batch) {
        map.set(k, v);
      }
    },
    async ensureOne(placeId) {
      if (map.has(placeId)) {
        return map.get(placeId) ?? null;
      }
      const { data, error } = await supabase
        .from(table)
        .select(TRACKING_SELECT_COLUMNS)
        .eq("place_id", placeId)
        .maybeSingle();
      if (error) {
        throw new Error(`ensureOne(${placeId}): ${error.message}`);
      }
      if (data) {
        map.set(placeId, data);
      }
      return data ?? null;
    },
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} statRow
 */
export async function recordConversionStat(supabase, statRow) {
  const { error } = await supabase.from("conversion_stats").insert(statRow);
  if (error) {
    console.error("conversion_stats insert failed:", error.message);
  }
}

/**
 * Update business row + optional conversion_stats insert.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {object} payload scrape row (rowToBusiness shape)
 * @param {object|null|undefined} existing
 * @param {Date} [now]
 * @returns {Promise<boolean>} true if new conversion recorded
 */
/**
 * @param {object} payload
 * @returns {Record<string, unknown>}
 */
function scrapeFieldsForConversionUpdate(payload) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of CONVERSION_BUSINESS_UPDATE_KEYS) {
    if (payload[key] !== undefined) {
      out[key] = payload[key];
    }
  }
  return out;
}

export async function applyConversionUpdate(
  supabase,
  table,
  payload,
  existing,
  now = new Date(),
) {
  const tracking = applyTrackingToPayload({ existing, payload, now });
  const updateRow = {
    ...scrapeFieldsForConversionUpdate(payload),
    ...tracking.fields,
  };

  const { error } = await supabase
    .from(table)
    .update(updateRow)
    .eq("place_id", payload.place_id);

  if (error) {
    throw new Error(`conversion update (${payload.place_id}): ${error.message}`);
  }

  if (tracking.statRow) {
    await recordConversionStat(supabase, tracking.statRow);
  }

  return tracking.converted;
}

/**
 * @param {object} payload
 * @param {{ existing?: object|null, now?: Date }} ctx
 * @returns {object}
 */
export function mergeTrackingIntoPayload(payload, ctx) {
  const tracking = applyTrackingToPayload({
    existing: ctx.existing ?? null,
    payload,
    now: ctx.now ?? new Date(),
  });
  return { ...payload, ...tracking.fields };
}

/**
 * Prefetch + merge tracking fields into each payload before batch upsert.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {object[]} payloads
 * @param {Date} [now]
 * @returns {Promise<{ conversionsRecorded: number }>}
 */
export async function mergeTrackingIntoPayloadBatch(
  supabase,
  table,
  payloads,
  now = new Date(),
) {
  const ids = payloads.map((p) => p.place_id).filter(Boolean);
  const existingByPlace = await prefetchExistingByPlaceId(supabase, table, ids);
  let conversionsRecorded = 0;

  for (const payload of payloads) {
    const existing = existingByPlace.get(payload.place_id) ?? null;
    const tracking = applyTrackingToPayload({ existing, payload, now });
    Object.assign(payload, tracking.fields);
    if (tracking.statRow) {
      await recordConversionStat(supabase, tracking.statRow);
      conversionsRecorded += 1;
    }
  }

  return { conversionsRecorded };
}

/**
 * True when we should run conversion update instead of skipping has_website rows.
 *
 * @param {object} payload
 * @param {object|null|undefined} existing
 */
export function shouldRecordConversion(payload, existing) {
  return (
    hasRealWebsite(payload) &&
    existing != null &&
    hadNoRealWebsite(existing) &&
    !existing.converted
  );
}
