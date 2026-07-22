import "server-only";

/**
 * Platform Telegram bot for postcard scan alerts.
 * Users store their own chat id on profiles.telegram_chat_id.
 */

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

export function normalizeTelegramChatId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Private chats are positive; groups/supergroups are negative.
  if (!/^-?\d{5,20}$/.test(trimmed)) return null;
  return trimmed;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const normalizedChatId = normalizeTelegramChatId(chatId);
  if (!normalizedChatId) {
    return { ok: false, error: "Invalid Telegram chat id" };
  }

  const body = text.trim();
  if (!body) {
    return { ok: false, error: "Message body is empty" };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: normalizedChatId,
          text: body.slice(0, 4096),
          disable_web_page_preview: true,
        }),
      },
    );

    const data = (await response.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!response.ok || data.ok !== true) {
      return {
        ok: false,
        error: data.description?.trim() || `Telegram HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach Telegram";
    return { ok: false, error: message };
  }
}
