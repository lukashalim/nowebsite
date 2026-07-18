"use server";

import { revalidatePath } from "next/cache";
import { validateLobApiKey } from "@/lib/lob";
import {
  normalizePostcardReturnAddress,
  type PostcardReturnAddressInput,
} from "@/lib/postcard/address";
import { getLobProfilePublic, getUserLobApiKey } from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function revalidateLobPaths() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/crm");
  revalidatePath("/crm/postcards");
}

export async function updateLobSettings(input: {
  lob_api_key: string;
  return_address: PostcardReturnAddressInput;
}): Promise<
  | {
      ok: true;
      mode: "test" | "live" | null;
      has_return_address: boolean;
    }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const existing = await getLobProfilePublic(user.id);
  const keyInput = input.lob_api_key.trim();

  let nextKey: string | null = null;
  let mode: "test" | "live" | null = existing.lob_key_mode;

  if (keyInput) {
    const validation = await validateLobApiKey(keyInput);
    if (!validation.ok) {
      return validation;
    }
    nextKey = keyInput;
    mode = validation.mode;
  } else if (existing.has_lob_api_key) {
    nextKey = await getUserLobApiKey(user.id);
  } else {
    return { ok: false, error: "Lob API key is required" };
  }

  const addressParsed = normalizePostcardReturnAddress(input.return_address);
  if (!addressParsed.ok) {
    return addressParsed;
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      lob_api_key: nextKey,
      postcard_return_address: addressParsed.address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLobPaths();
  return { ok: true, mode, has_return_address: true };
}

export async function clearLobSettings(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      lob_api_key: null,
      postcard_return_address: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLobPaths();
  return { ok: true };
}
