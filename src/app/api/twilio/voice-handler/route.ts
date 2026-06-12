import { NextResponse } from "next/server";
import Twilio from "twilio";
import { getUserTwilioCredentials } from "@/lib/subscription";
import { absoluteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twimlResponse(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() ?? "";
  const target = url.searchParams.get("target")?.trim() ?? "";

  if (!userId || !target) {
    return twimlResponse(
      "<Response><Say>Invalid call configuration.</Say></Response>",
    );
  }

  const credentials = await getUserTwilioCredentials(userId);
  if (!credentials) {
    return twimlResponse(
      "<Response><Say>Twilio credentials not configured.</Say></Response>",
    );
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const isValid = Twilio.validateRequest(
    credentials.authToken,
    signature,
    absoluteUrl(`/api/twilio/voice-handler?userId=${encodeURIComponent(userId)}&target=${encodeURIComponent(target)}`),
    params,
  );

  if (!isValid) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const escapedTarget = target
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  const escapedCallerId = credentials.phoneNumber
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return twimlResponse(
    `<Response><Dial callerId="${escapedCallerId}">${escapedTarget}</Dial></Response>`,
  );
}
