import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, adminCookieOptions } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303,
  );
  const options = adminCookieOptions();
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...options,
    maxAge: 0,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...options,
    path: "/admin",
    maxAge: 0,
  });
  return response;
}
