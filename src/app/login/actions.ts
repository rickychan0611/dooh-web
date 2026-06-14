"use server";

import { redirect } from "next/navigation";
import { getEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signIn(formData: FormData) {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (email !== getEnv().OWNER_ALLOWLIST_EMAIL.toLowerCase()) {
    redirect("/login?error=not-allowed");
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid-credentials");
  }

  redirect("/dashboard");
}

export async function signOut() {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
