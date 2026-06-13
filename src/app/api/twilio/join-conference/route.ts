import { NextResponse } from "next/server";
import { getUserTwilioCredentials } from "@/lib/subscription";
import {
  escapeXmlAttribute,
  validateTwilioWebhookRequest,
} from "@/lib/twilio-credentials";

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
  const roomId = url.searchParams.get("roomId")?.trim() ?? "";

  if (!userId || !roomId) {
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

  const webhookUrl = url.toString();
  const isValid = validateTwilioWebhookRequest(
    credentials.authToken,
    signature,
    webhookUrl,
    params,
  );

  if (!isValid) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const escapedCallerId = escapeXmlAttribute(credentials.phoneNumber);
  const escapedRoomId = escapeXmlAttribute(roomId);

  return twimlResponse(
    `<Response><Dial callerId="${escapedCallerId}"><Conference beep="false" endConferenceOnExit="true" startConferenceOnEnter="true">${escapedRoomId}</Conference></Dial></Response>`,
  );
}
