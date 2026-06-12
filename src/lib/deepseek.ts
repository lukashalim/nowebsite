import "server-only";

import { loadSharedEnvLocal } from "@/lib/load-shared-env";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChatOptions {
  maxTokens?: number;
  temperature?: number;
  jsonObject?: boolean;
}

export function getDeepSeekApiKey(): string {
  loadSharedEnvLocal();
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }
  return key;
}

export async function deepseekChat(
  messages: DeepSeekMessage[],
  options: DeepSeekChatOptions = {},
): Promise<string> {
  const key = getDeepSeekApiKey();
  const { maxTokens = 256, temperature = 0.1, jsonObject = false } = options;

  const body: Record<string, unknown> = {
    model: "deepseek-chat",
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (jsonObject) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `DeepSeek API error (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned empty response");
  }
  return content;
}
