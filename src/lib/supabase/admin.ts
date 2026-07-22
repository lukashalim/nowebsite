import { createClient } from "@supabase/supabase-js";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";

/**
 * Service-role client. Force cache: "no-store" so Next.js does not memoize
 * identical Supabase GETs across a mutate-then-reselect in one request
 * (otherwise create-on-read demo pages 404 after a successful upsert).
 */
export function createSupabaseAdmin() {
  loadSharedEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
}
