import { redirect } from "next/navigation";
import { getEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireAdmin() {
  const admin = getSupabaseAdmin();
  const { data: organization } = await admin
    .from("organizations")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();

  if (!organization) throw new Error("Organization seed is missing.");

  if (isDevAuthBypassEnabled()) {
    return {
      user: {
        id: null,
        email: getEnv().OWNER_ALLOWLIST_EMAIL,
      },
      organizationId: organization.id,
    };
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");
  if (user.email.toLowerCase() !== getEnv().OWNER_ALLOWLIST_EMAIL.toLowerCase()) {
    throw new Error("This account is not allowlisted.");
  }

  await admin.from("admin_users").upsert(
    {
      organization_id: organization.id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "organization_id,user_id" },
  );

  return { user, organizationId: organization.id };
}

export async function optionalAdmin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}
