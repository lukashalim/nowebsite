const SENDFOX_API_BASE = "https://api.sendfox.com";

export interface SendFoxContact {
  id: number;
  email: string;
  confirmed_at: string | null;
}

interface SendFoxContactsResponse {
  data?: SendFoxContact[];
}

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

export async function getContactByEmail(
  email: string,
): Promise<SendFoxContact | null> {
  const token = getSendFoxToken();
  const url = new URL(`${SENDFOX_API_BASE}/contacts`);
  url.searchParams.set("email", email);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("SendFox authentication failed");
  }

  if (response.status >= 500) {
    throw new Error("SendFox service unavailable");
  }

  if (!response.ok) {
    throw new Error("Failed to look up contact");
  }

  const body = (await response.json()) as SendFoxContact | SendFoxContactsResponse;

  if ("data" in body && Array.isArray(body.data)) {
    return body.data[0] ?? null;
  }

  if ("id" in body && typeof body.id === "number") {
    return body as SendFoxContact;
  }

  return null;
}

export async function isEmailConfirmed(email: string): Promise<boolean> {
  const contact = await getContactByEmail(email);
  return contact?.confirmed_at != null;
}

export async function addContactToListBestEffort(email: string): Promise<void> {
  try {
    await addContactToList(email);
  } catch {
    // Non-blocking: CRM sign-in and other flows must not fail when SendFox is down.
  }
}
