import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("admin_users")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);
  if (memberships?.length) redirect("/dashboard");

  const metadata = user.user_metadata ?? {};
  if (metadata.account_kind !== "business" || !metadata.organization_name) {
    redirect("/signup");
  }

  const { error } = await supabase.rpc(
    "create_organization_for_current_user",
    {
      organization_name: metadata.organization_name,
      target_country: metadata.country === "US" ? "US" : "CA",
      target_currency: metadata.currency === "usd" ? "usd" : "cad",
      target_timezone: metadata.timezone || "America/Vancouver",
    },
  );
  if (error) {
    return (
      <main className="center-shell">
        <section className="panel auth-panel">
          <h1>Workspace setup needs attention</h1>
          <p className="notice danger">{error.message}</p>
        </section>
      </main>
    );
  }
  redirect("/dashboard?welcome=1");
}
