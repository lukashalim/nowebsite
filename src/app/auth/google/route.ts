import { NextResponse } from "next/server";
import {
  buildOAuthCallbackUrl,
  getPostAuthNextPath,
  getRequestOrigin,
} from "@/lib/auth-redirect";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const redirectTo = buildOAuthCallbackUrl(request);
  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const response = NextResponse.redirect(data.url);
  const next = getPostAuthNextPath(request);
  if (next !== "/crm") {
    response.cookies.set("auth_next", next, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  return applyCookies(response);
}
