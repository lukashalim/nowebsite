/**
 * Demo URL slugs: /demo/advancedpaintpros — collisions get numeric suffix (advancedpaintpros2).
 */

const MAX_SLUG_LEN = 48;

/**
 * @param {string|null|undefined} name
 * @param {string} placeId
 */
export function slugifyDemoName(name, placeId) {
  const fromName = String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
  if (fromName.length >= 3) {
    return fromName.slice(0, MAX_SLUG_LEN);
  }
  const tail = String(placeId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(-10);
  const fallback = `biz${tail}`.slice(0, MAX_SLUG_LEN);
  return fallback.length >= 3 ? fallback : "business";
}

/** Google Maps place ids used in legacy /demo/ChIJ… URLs. */
export function isLikelyGooglePlaceId(s) {
  return /^ChIJ[A-Za-z0-9_-]+$/.test(String(s ?? "").trim());
}

/**
 * Load existing slug assignments from Supabase.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} table
 */
export async function createDemoSlugAllocator(supabase, table) {
  /** @type {Map<string, string>} slug -> place_id */
  const slugToPlace = new Map();
  /** @type {Map<string, string>} place_id -> slug */
  const placeToSlug = new Map();

  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("place_id, demo_slug")
      .not("demo_slug", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }
    const rows = data ?? [];
    for (const row of rows) {
      const pid = row.place_id != null ? String(row.place_id).trim() : "";
      const slug =
        row.demo_slug != null ? String(row.demo_slug).trim().toLowerCase() : "";
      if (!pid || !slug) continue;
      slugToPlace.set(slug, pid);
      placeToSlug.set(pid, slug);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { slugToPlace, placeToSlug };
}

/**
 * Mutates `payload` with `demo_slug` (stable if already assigned for place_id).
 * @param {{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }} state
 * @param {{ place_id: string, name?: string|null }} payload
 */
export function assignDemoSlugToPayload(state, payload) {
  const pid = payload.place_id != null ? String(payload.place_id).trim() : "";
  if (!pid) return;

  const existing = state.placeToSlug.get(pid);
  if (existing) {
    payload.demo_slug = existing;
    return;
  }

  const base = slugifyDemoName(payload.name, pid);
  let candidate = base;
  let n = 2;
  let guard = 0;
  while (state.slugToPlace.has(candidate)) {
    const owner = state.slugToPlace.get(candidate);
    if (owner === pid) break;
    candidate = `${base}${n}`;
    n += 1;
    guard += 1;
    if (guard > 5000) {
      candidate = `${base}x${pid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(-6)}`;
      break;
    }
  }

  state.slugToPlace.set(candidate, pid);
  state.placeToSlug.set(pid, candidate);
  payload.demo_slug = candidate;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} table
 * @param {Array<Record<string, unknown>>} payloads
 */
export async function attachDemoSlugsToPayloads(supabase, table, payloads) {
  const state = await createDemoSlugAllocator(supabase, table);
  for (const p of payloads) {
    assignDemoSlugToPayload(state, p);
  }
}
