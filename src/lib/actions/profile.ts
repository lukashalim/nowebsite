"use server";

import { revalidatePath } from "next/cache";
import { USERNAME_PATTERN } from "@/lib/profile-username";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isUniqueUsernameViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" &&
    (error.message?.includes("username") ?? false)
  );
}

export async function updateProfileSettings(input: {
  username: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const username = input.username.trim().toLowerCase();
  if (!username) {
    return { ok: false, error: "Username is required" };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error:
        "Username must be 3–32 characters: lowercase letters, numbers, hyphens, or underscores",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (isUniqueUsernameViolation(error)) {
      return { ok: false, error: "Username is already taken" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
