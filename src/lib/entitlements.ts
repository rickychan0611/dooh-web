import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { devOrganizationEntitlements } from "@/lib/dev-bypass";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { serviceState } from "@/lib/subscription-state";

export { serviceState } from "@/lib/subscription-state";

export async function getOrganizationEntitlements(organizationId: string) {
  if (isDevAuthBypassEnabled()) {
    return devOrganizationEntitlements(organizationId);
  }

  const admin = getSupabaseAdmin();
  const [{ data: organization }, { data: entitlements }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", organizationId).single(),
    admin
      .from("organization_entitlements")
      .select("*")
      .eq("organization_id", organizationId)
      .single(),
  ]);
  if (!organization) throw new Error("Organization not found.");
  return {
    organization,
    entitlements,
    serviceState: serviceState(organization),
    licensedScreens: Number(organization.screen_license_quantity ?? 0),
    storageLimitBytes:
      Number(entitlements?.storage_bytes_per_license ?? 1073741824) *
      Number(organization.screen_license_quantity ?? 0),
  };
}
