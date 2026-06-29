"use server";

import { redirect } from "next/navigation";
import { getEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createBusinessAccount(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const organizationName = text(formData, "organizationName");
  const country = text(formData, "country") === "US" ? "US" : "CA";
  const currency = country === "US" ? "usd" : "cad";
  const timezone = text(formData, "timezone") || "America/Vancouver";
  if (!organizationName) redirect("/signup?error=business-name");
  if (isDevAuthBypassEnabled()) redirect("/dashboard?welcome=1");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
      data: {
        organization_name: organizationName,
        country,
        currency,
        timezone,
        account_kind: "business",
      },
    },
  });
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  if (!data.session) redirect("/signup?message=check-email");
  redirect("/onboarding");
}
