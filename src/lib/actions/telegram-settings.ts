"use server";

import { revalidatePath } from "next/cache";
import {
  getTelegramBotToken,
  normalizeTelegramChatId,
  sendTelegramMessage,
} from "@/lib/telegram";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getTelegramProfilePublic(userId: string): Promise<{
  telegram_chat_id: string;
  bot_configured: boolean;
}> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle();

  const chatId =
    typeof data?.telegram_chat_id === "string" ? data.telegram_chat_id : "";

  return {
    telegram_chat_id: chatId,
    bot_configured: getTelegramBotToken() != null,
  };
}

export async function updateTelegramSettings(input: {
  telegram_chat_id: string;
  send_test?: boolean;
}): Promise<
  | { ok: true; tested: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const raw = input.telegram_chat_id.trim();
  const chatId = raw ? normalizeTelegramChatId(raw) : null;

  if (raw && !chatId) {
    return {
      ok: false,
      error: "Chat id must be a number (e.g. 123456789). Negative ids are OK for groups.",
    };
  }

  if (chatId && !getTelegramBotToken()) {
    return {
      ok: false,
      error: "Telegram bot is not configured on the server (TELEGRAM_BOT_TOKEN).",
    };
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      telegram_chat_id: chatId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  let tested = false;
  if (chatId && input.send_test) {
    const result = await sendTelegramMessage(
      chatId,
      "Postcard scan alerts are connected. You'll get a message when a lead scans a postcard QR (test scans are labeled).",
    );
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    tested = true;
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, tested };
}
