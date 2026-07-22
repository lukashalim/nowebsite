import "server-only";

import { absoluteUrl } from "@/lib/site-url";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  USAGE_EVENT_COLUMNS,
  USAGE_EVENTS_TABLE,
} from "@/lib/usage-storage";
import type { PostcardScanPayload } from "@/lib/postcard/scan-link";

/**
 * Best-effort Telegram alert on first postcard QR scan (live or test).
 * Never throws — scan redirect must stay fast and reliable.
 */
export async function notifyPostcardScan(
  payload: PostcardScanPayload,
): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const eventType = payload.isTest
      ? "postcard_scanned_test"
      : "postcard_scanned";

    const { count, error: countError } = await admin
      .from(USAGE_EVENTS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq(USAGE_EVENT_COLUMNS.userId, payload.userId)
      .eq(USAGE_EVENT_COLUMNS.eventType, eventType)
      .eq(USAGE_EVENT_COLUMNS.leadId, payload.placeId);

    if (countError) {
      console.warn("[postcard-scan-alert] count failed", countError.message);
      return;
    }
    // logUsageEvent already inserted this scan — alert only on the first hit.
    if ((count ?? 0) !== 1) {
      console.info("[postcard-scan-alert] skip non-first scan", {
        eventType,
        placeId: payload.placeId,
        count,
      });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", payload.userId)
      .maybeSingle();

    if (profileError) {
      console.warn("[postcard-scan-alert] profile failed", profileError.message);
      return;
    }

    const chatId =
      typeof profile?.telegram_chat_id === "string"
        ? profile.telegram_chat_id.trim()
        : "";
    if (!chatId) {
      console.info("[postcard-scan-alert] skip — no telegram_chat_id", {
        userId: payload.userId,
      });
      return;
    }

    const { data: business } = await admin
      .from("businesses_nowebsite")
      .select("name, phone, city, state")
      .eq("place_id", payload.placeId)
      .maybeSingle();

    const name =
      typeof business?.name === "string" && business.name.trim()
        ? business.name.trim()
        : "a lead";
    const phone =
      typeof business?.phone === "string" && business.phone.trim()
        ? business.phone.trim()
        : null;
    const city =
      typeof business?.city === "string" ? business.city.trim() : "";
    const state =
      typeof business?.state === "string" ? business.state.trim() : "";
    const location = [city, state].filter(Boolean).join(", ");

    const lines = [
      payload.isTest
        ? "Postcard scanned (TEST — Lob test key, not a live mailpiece)"
        : "Postcard scanned",
      "",
      name,
      ...(phone ? [`Phone: ${phone}`] : []),
      ...(location ? [location] : []),
      "",
      absoluteUrl(
        payload.isTest
          ? "/crm/postcards?mode=test&status=scanned"
          : "/crm/postcards?status=scanned",
      ),
    ];

    const result = await sendTelegramMessage(chatId, lines.join("\n"));
    if (!result.ok) {
      console.warn("[postcard-scan-alert] send failed", result.error);
    }
  } catch (error) {
    console.warn(
      "[postcard-scan-alert] unexpected",
      error instanceof Error ? error.message : error,
    );
  }
}
