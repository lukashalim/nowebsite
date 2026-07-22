"use server";

import { revalidatePath } from "next/cache";
import { validateLobApiKey } from "@/lib/lob";
import {
  normalizePostcardReturnAddress,
  type PostcardReturnAddressInput,
} from "@/lib/postcard/address";
import {
  getLobProfilePublic,
  getUserLobLiveApiKey,
  getUserLobTestApiKey,
} from "@/lib/subscription";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function revalidateLobPaths() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/crm");
  revalidatePath("/crm/postcards");
}

export async function updateLobSettings(input: {
  lob_test_api_key: string;
  lob_live_api_key: string;
  return_address: PostcardReturnAddressInput;
}): Promise<
  | {
      ok: true;
      has_lob_test_api_key: boolean;
      has_lob_live_api_key: boolean;
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
  const testInput = input.lob_test_api_key.trim();
  const liveInput = input.lob_live_api_key.trim();

  let nextTestKey: string | null = null;
  if (testInput) {
    const validation = await validateLobApiKey(testInput);
    if (!validation.ok) {
      return validation;
    }
    if (validation.mode !== "test") {
      return {
        ok: false,
        error: "Test key must start with test_ (Lob secret key)",
      };
    }
    nextTestKey = testInput;
  } else if (existing.has_lob_test_api_key) {
    nextTestKey = await getUserLobTestApiKey(user.id);
  }

  let nextLiveKey: string | null = null;
  if (liveInput) {
    const validation = await validateLobApiKey(liveInput);
    if (!validation.ok) {
      return validation;
    }
    if (validation.mode !== "live") {
      return {
        ok: false,
        error: "Production key must start with live_ (Lob secret key)",
      };
    }
    nextLiveKey = liveInput;
  } else if (existing.has_lob_live_api_key) {
    nextLiveKey = await getUserLobLiveApiKey(user.id);
  }

  if (!nextTestKey && !nextLiveKey) {
    return {
      ok: false,
      error: "Add at least one Lob API key (test or production)",
    };
  }

  const addressParsed = normalizePostcardReturnAddress(input.return_address);
  if (!addressParsed.ok) {
    return addressParsed;
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      lob_test_api_key: nextTestKey,
      lob_api_key: nextLiveKey,
      postcard_return_address: addressParsed.address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLobPaths();
  return {
    ok: true,
    has_lob_test_api_key: Boolean(nextTestKey),
    has_lob_live_api_key: Boolean(nextLiveKey),
    has_return_address: true,
  };
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
      lob_test_api_key: null,
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
