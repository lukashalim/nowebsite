import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  addContactToListBestEffort,
  getContactByEmail,
} from "@/lib/sendfox";

export interface SendFoxProfileSyncResult {
  subscribed: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function updateProfileSendFoxFields(
  userId: string,
  fields: {
    sendfox_subscribed_at?: string;
    sendfox_confirmed_at?: string | null;
  },
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Subscribe email to SendFox and persist subscription + confirmation on profiles. */
export async function syncSendFoxProfileForUser(
  userId: string,
  email: string,
): Promise<SendFoxProfileSyncResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { subscribed: false, confirmed: false, confirmedAt: null };
  }

  await addContactToListBestEffort(normalized);

  const now = new Date().toISOString();
  let confirmedAt: string | null = null;

  try {
    const contact = await getContactByEmail(normalized);
    confirmedAt = contact?.confirmed_at ?? null;
  } catch {
    // Subscription was attempted; confirmation can be refreshed later.
  }

  await updateProfileSendFoxFields(userId, {
    sendfox_subscribed_at: now,
    sendfox_confirmed_at: confirmedAt,
  });

  return {
    subscribed: true,
    confirmed: confirmedAt != null,
    confirmedAt,
  };
}

/** Poll SendFox and update profiles.sendfox_confirmed_at when double opt-in completes. */
export async function refreshSendFoxConfirmationForUser(
  userId: string,
  email: string,
): Promise<SendFoxProfileSyncResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { subscribed: false, confirmed: false, confirmedAt: null };
  }

  let contact = null;
  try {
    contact = await getContactByEmail(normalized);
  } catch {
    return { subscribed: false, confirmed: false, confirmedAt: null };
  }

  const confirmedAt = contact?.confirmed_at ?? null;
  if (confirmedAt) {
    await updateProfileSendFoxFields(userId, {
      sendfox_confirmed_at: confirmedAt,
    });
  }

  return {
    subscribed: contact != null,
    confirmed: confirmedAt != null,
    confirmedAt,
  };
}
