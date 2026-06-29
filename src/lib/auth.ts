import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type OrganizationRole = "owner" | "admin" | "editor" | "viewer";

export type OrganizationContext = {
  user: { id: string | null; email?: string | null };
  organizationId: string;
  organization: Record<string, any>;
  role: OrganizationRole;
  memberships: Array<{
    organization_id: string;
    role: OrganizationRole;
    organizations: Record<string, any>;
  }>;
};

const ACTIVE_ORG_COOKIE = "dooh-active-organization";
const DEV_MOCK_ORG_ID = "00000000-0000-0000-0000-000000000001";

function devMockMembership(): OrganizationContext["memberships"][number] {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return {
    organization_id: DEV_MOCK_ORG_ID,
    role: "owner",
    organizations: {
      id: DEV_MOCK_ORG_ID,
      name: "Dev Workspace",
      slug: "dev-workspace",
      country_code: "CA",
      billing_currency: "cad",
      timezone: "America/Vancouver",
      status: "trialing",
      trial_ends_at: trialEndsAt,
      screen_license_quantity: 1,
    },
  };
}

function platformOwnerEmails() {
  return getEnv()
    .PLATFORM_OWNER_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCurrentUser() {
  if (isDevAuthBypassEnabled()) {
    return { id: null, email: platformOwnerEmails()[0] ?? "dev@example.com" };
  }
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export const requireOrganization = cache(async function requireOrganization(
  allowedRoles: OrganizationRole[] = ["owner", "admin", "editor", "viewer"],
): Promise<OrganizationContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let memberships: OrganizationContext["memberships"] = [];
  if (isDevAuthBypassEnabled()) {
    memberships = [devMockMembership()];
  } else {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("admin_users")
      .select("organization_id,role,organizations(*)")
      .eq("user_id", user.id)
      .order("created_at");
    memberships = data ?? [];
  }

  if (!memberships.length) {
    if (isDevAuthBypassEnabled()) {
      memberships = [devMockMembership()];
    } else {
      redirect("/onboarding");
    }
  }
  const cookieStore = await cookies();
  const requestedOrganizationId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const membership =
    memberships.find(
      (item) => item.organization_id === requestedOrganizationId,
    ) ?? memberships[0];

  if (!allowedRoles.includes(membership.role)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return {
    user,
    organizationId: membership.organization_id,
    organization: membership.organizations,
    role: membership.role,
    memberships,
  };
});

export async function requireAdmin() {
  return requireOrganization(["owner", "admin", "editor", "viewer"]);
}

export async function requireManager() {
  return requireOrganization(["owner", "admin"]);
}

export async function requireEditor() {
  return requireOrganization(["owner", "admin", "editor"]);
}

export async function requirePlatformOwner() {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/login");
  const isConfiguredOwner = platformOwnerEmails().includes(
    user.email.toLowerCase(),
  );
  if (!isConfiguredOwner && user.id) {
    const { data } = await getSupabaseAdmin()
      .from("platform_owners")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Platform owner access required.");
  }
  return user;
}

export async function optionalAdmin() {
  try {
    return await requireOrganization();
  } catch {
    return null;
  }
}

export async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
