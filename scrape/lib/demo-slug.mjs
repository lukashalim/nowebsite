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

export function isDemoSlugConflictError(message) {
  return /demo_slug|idx_businesses_nowebsite_demo_slug_unique/i.test(
    String(message ?? ""),
  );
}

/**
 * @param {{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }} state
 * @param {string} pid
 * @param {string|undefined|null} slug
 */
export function clearDemoSlugReservation(state, pid, slug) {
  const placeId = String(pid ?? "").trim();
  if (placeId) {
    state.placeToSlug.delete(placeId);
  }
  const normalized =
    slug != null ? String(slug).trim().toLowerCase() : "";
  if (normalized) {
    const owner = state.slugToPlace.get(normalized);
    if (!owner || owner === placeId) {
      state.slugToPlace.delete(normalized);
    }
  }
}

/**
 * Register a slug owner from DB into the in-memory allocator.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} table
 * @param {{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }} state
 * @param {string} slug
 */
export async function syncSlugReservationFromDb(supabase, table, state, slug) {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) return;

  const { data, error } = await supabase
    .from(table)
    .select("place_id")
    .eq("demo_slug", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.place_id) return;

  const pid = String(data.place_id).trim();
  state.slugToPlace.set(normalized, pid);
  state.placeToSlug.set(pid, normalized);
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
      .order("place_id", { ascending: true })
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
    const suffix = String(n);
    const trimmedBase = base.slice(0, Math.max(1, MAX_SLUG_LEN - suffix.length));
    candidate = `${trimmedBase}${suffix}`;
    n += 1;
    guard += 1;
    if (guard > 5000) {
      const tail = pid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(-6);
      const trimmedBase = base.slice(0, Math.max(1, MAX_SLUG_LEN - 1 - tail.length));
      candidate = `${trimmedBase}x${tail}`;
      break;
    }
  }

  state.slugToPlace.set(candidate, pid);
  state.placeToSlug.set(pid, candidate);
  payload.demo_slug = candidate;
}

/**
 * After a unique-index failure, sync DB reservations and pick the next free slug.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} table
 * @param {{ slugToPlace: Map<string, string>, placeToSlug: Map<string, string> }} state
 * @param {{ place_id: string, name?: string|null, demo_slug?: string|null }} payload
 */
export async function reassignDemoSlugAfterConflict(
  supabase,
  table,
  state,
  payload,
) {
  const pid = payload.place_id != null ? String(payload.place_id).trim() : "";
  if (!pid) return;

  const failedSlug = payload.demo_slug;
  if (failedSlug) {
    try {
      await syncSlugReservationFromDb(supabase, table, state, failedSlug);
    } catch {
      // Best-effort; allocator will still bump suffix below.
    }
  }
  clearDemoSlugReservation(state, pid, failedSlug);
  assignDemoSlugToPayload(state, payload);
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
