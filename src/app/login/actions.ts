"use server";

import { redirect } from "next/navigation";
import { getEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email !== getEnv().OWNER_ALLOWLIST_EMAIL.toLowerCase()) {
    redirect("/login?error=not-allowed");
  }
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getEnv().NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) redirect("/login?error=send-failed");
  redirect("/login?sent=1");
}

export async function signOut() {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
