"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  requirePublicUser,
  safeReturnPath,
} from "@/lib/public-auth";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signUp(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const next = safeReturnPath(formData.get("next"), "/account/profile");
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect(`/account/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }
  if (!data.session) {
    redirect(`/account/login?message=check-email&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signIn(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const next = safeReturnPath(formData.get("next"), "/account");
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/account/login?error=invalid-credentials&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function publicSignOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/screens");
}

export async function requestPasswordReset(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const supabase = await getSupabaseServer();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/reset-password`,
  });
  redirect("/account/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  await requirePublicUser("/account/reset-password");
  const password = text(formData, "password");
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account/reset-password?error=update-failed");
  redirect("/account/profile?password=updated");
}

export async function updateProfile(formData: FormData) {
  const user = await requirePublicUser("/account/profile");
  const { error } = await getSupabaseAdmin().from("user_profiles").upsert({
    user_id: user.id,
    display_name: text(formData, "displayName").slice(0, 80),
    contact: text(formData, "contact").slice(0, 160),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/account/profile");
  redirect("/account/profile?saved=1");
}
