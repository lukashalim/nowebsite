"use server";

import { revalidatePath } from "next/cache";
import {
  fetchSpintaxTemplatesForUser,
  validateSpintaxTemplateInput,
  type SpintaxTemplate,
} from "@/lib/spintax-templates";
import { CRM_BASE_PATH } from "@/lib/crm-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SPINTAX_PATH = `${CRM_BASE_PATH}/spintax`;

function revalidateSpintaxPaths() {
  revalidatePath(CRM_BASE_PATH);
  revalidatePath(SPINTAX_PATH);
}

export async function listSpintaxTemplates(): Promise<
  { ok: true; templates: SpintaxTemplate[] } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const { templates, error } = await fetchSpintaxTemplatesForUser(
    supabase,
    user.id,
  );
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, templates };
}

export async function updateSpintaxTemplate(
  id: string,
  name: string,
  template: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Invalid template" };
  }

  const validationError = validateSpintaxTemplateInput(name, template);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const { error } = await supabase
    .from("spintax_templates")
    .update({
      name: name.trim(),
      template,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateSpintaxPaths();
  return { ok: true };
}

export async function createSpintaxTemplate(
  name: string,
  template: string,
): Promise<
  { ok: true; template: SpintaxTemplate } | { ok: false; error: string }
> {
  const validationError = validateSpintaxTemplateInput(name, template);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in required" };
  }

  const { data, error } = await supabase
    .from("spintax_templates")
    .insert({
      user_id: user.id,
      name: name.trim(),
      template,
    })
    .select("id, name, template, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create template" };
  }

  revalidateSpintaxPaths();
  return {
    ok: true,
    template: {
      id: String(data.id),
      name: String(data.name),
      template: String(data.template),
      created_at: String(data.created_at),
    },
  };
}
