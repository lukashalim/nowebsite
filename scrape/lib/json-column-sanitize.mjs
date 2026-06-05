/**
 * Postgres json/jsonb rejects lone UTF-16 surrogates (e.g. excerpts truncated mid-emoji).
 */

/**
 * @param {string} s
 * @returns {string}
 */
export function stripLoneSurrogates(s) {
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i += 1;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) {
      continue;
    }
    if (c === 0) {
      continue;
    }
    out += s[i];
  }
  return out;
}

/**
 * @param {string} s
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateForJson(s, maxLen) {
  let t = stripLoneSurrogates(String(s).replace(/\s+/g, " ").trim());
  if (t.length <= maxLen) return t;
  t = stripLoneSurrogates(t.slice(0, maxLen)).trim();
  return t;
}

/**
 * Deep-clone JSON-safe data for Supabase json/jsonb columns.
 *
 * @param {unknown} value
 * @returns {unknown|null}
 */
export function sanitizeJsonColumn(value) {
  if (value == null) return null;
  try {
    const json = JSON.stringify(value, (_key, v) => {
      if (typeof v === "string") return stripLoneSurrogates(v);
      if (typeof v === "bigint") return v.toString();
      return v;
    });
    return JSON.parse(json);
  } catch {
    return null;
  }
}
