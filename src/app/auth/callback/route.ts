import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { getRequestOrigin } from "@/lib/auth-redirect";
import { ensureProfileUsername } from "@/lib/profile-username";
import { trackUserSession } from "@/lib/track-user-session";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectOrigin = getRequestOrigin(request);

  let next = searchParams.get("next") ?? CRM_BASE_PATH;
  if (!next.startsWith("/")) {
    next = CRM_BASE_PATH;
  }

  const cookieStore = await cookies();
  const nextFromCookie = cookieStore.get("auth_next")?.value;
  if (nextFromCookie?.startsWith("/")) {
    next = nextFromCookie;
  }

  if (code) {
    const { supabase, applyCookies } =
      await createSupabaseRouteHandlerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        await Promise.all([
          ensureProfileUsername(user.id, user.email).catch(() => null),
          trackUserSession(user.id),
        ]);
      }

      const response = NextResponse.redirect(`${redirectOrigin}${next}`);
      response.cookies.delete("auth_next");
      return applyCookies(response);
    }
  }

  const response = NextResponse.redirect(`${redirectOrigin}/auth/auth-code-error`);
  response.cookies.delete("auth_next");
  return response;
}
