const SENDFOX_API_BASE = "https://api.sendfox.com";

function getSendFoxToken(): string {
  const token =
    process.env.SENDFOX_PERSIONAL_ACCESS_TOKEN ??
    process.env.SENDFOX_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing SENDFOX_PERSIONAL_ACCESS_TOKEN");
  }
  return token;
}

function getSendFoxListId(): number {
  const raw = process.env.SENDFOX_LIST_ID ?? "646710";
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid SENDFOX_LIST_ID");
  }
  return id;
}

export async function addContactToList(email: string): Promise<void> {
  const token = getSendFoxToken();
  const listId = getSendFoxListId();

  const response = await fetch(`${SENDFOX_API_BASE}/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, lists: [listId] }),
  });

  if (response.ok) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("SendFox authentication failed");
  }

  if (response.status >= 500) {
    throw new Error("SendFox service unavailable");
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  const message = body?.message?.toLowerCase() ?? "";

  if (
    response.status === 422 &&
    (message.includes("already") || message.includes("taken"))
  ) {
    return;
  }

  throw new Error(body?.message ?? "Failed to subscribe email");
}

export async function addContactToListBestEffort(email: string): Promise<void> {
  try {
    await addContactToList(email);
  } catch {
    // Non-blocking: CRM sign-in and other flows must not fail when SendFox is down.
  }
}
