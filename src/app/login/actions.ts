"use server";

import { redirect } from "next/navigation";
import {
  requireOrganization,
  setActiveOrganizationCookie,
} from "@/lib/auth";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signIn(formData: FormData) {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(formData, "email").toLowerCase(),
    password: text(formData, "password"),
  });
  if (error) redirect("/login?error=invalid-credentials");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export async function switchOrganization(formData: FormData) {
  const organizationId = text(formData, "organizationId");
  const { memberships } = await requireOrganization();
  if (!memberships.some((item) => item.organization_id === organizationId)) {
    throw new Error("Organization access required.");
  }
  await setActiveOrganizationCookie(organizationId);
  redirect("/dashboard");
}
