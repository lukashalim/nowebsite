import { NextResponse } from "next/server";
import {
  REPORT_COOKIE_NAME,
  reportCookieOptions,
  reportLoginPath,
} from "@/lib/client-report/auth";
import { getClientSiteById } from "@/lib/client-sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await context.params;
  const site = getClientSiteById(siteId);
  const loginPath = site ? reportLoginPath(site.id) : "/";
  const response = NextResponse.redirect(new URL(loginPath, request.url), 303);
  response.cookies.set(REPORT_COOKIE_NAME, "", {
    ...reportCookieOptions(),
    maxAge: 0,
  });
  return response;
}
