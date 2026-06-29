"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function inviteStaff(formData: FormData) {
  const { organizationId, organization, user } = await requireManager();
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");
  if (!["admin", "editor", "viewer"].includes(role)) {
    throw new Error("Invalid staff role.");
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
    data: { invited_organization_id: organizationId },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Invitation could not be created.");
  const { error: membershipError } = await admin.from("admin_users").upsert(
    {
      organization_id: organizationId,
      user_id: data.user.id,
      role,
    },
    { onConflict: "organization_id,user_id" },
  );
  if (membershipError) throw membershipError;
  await sendTransactionalEmail({
    to: email,
    subject: `You were invited to ${organization.name}`,
    heading: "Join the screen team",
    body: `You now have ${role} access to ${organization.name} in DOOH Community.`,
    actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/login`,
    actionLabel: "Open dashboard",
    idempotencyKey: `staff-invite-${organizationId}-${data.user.id}`,
  });
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "staff.invited",
    targetType: "user",
    targetId: data.user.id,
    metadata: { email, role },
  });
  revalidatePath("/dashboard/team");
}

export async function updateStaffRole(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const userId = text(formData, "userId");
  const role = text(formData, "role");
  if (!["admin", "editor", "viewer"].includes(role)) {
    throw new Error("Invalid staff role.");
  }
  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .neq("role", "owner");
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "staff.role_updated",
    targetType: "user",
    targetId: userId,
    metadata: { role },
  });
  revalidatePath("/dashboard/team");
}

export async function removeStaff(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const userId = text(formData, "userId");
  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .neq("role", "owner");
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "staff.removed",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/dashboard/team");
}
