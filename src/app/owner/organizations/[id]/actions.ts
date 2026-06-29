"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function setOrganizationStatus(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const status = text(formData, "status");
  if (!["trialing", "active", "grace", "suspended", "canceled"].includes(status)) {
    throw new Error("Invalid status.");
  }
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("organizations")
    .update({
      status,
      grace_ends_at:
        status === "grace"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : null,
      suspended_at: status === "suspended" ? now : null,
      deletion_scheduled_at:
        status === "suspended"
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null,
      updated_at: now,
    })
    .eq("id", organizationId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.organization_status_changed",
    targetType: "organization",
    targetId: organizationId,
    metadata: { status },
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function addSupportNote(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const body = text(formData, "body");
  if (!body) return;
  const { error } = await getSupabaseAdmin()
    .from("organization_support_notes")
    .insert({ organization_id: organizationId, author_user_id: user.id, body });
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.support_note_added",
    targetType: "organization",
    targetId: organizationId,
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function setFeatureFlag(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const flag = text(formData, "flag");
  const enabled = formData.get("enabled") === "on";
  const { error } = await getSupabaseAdmin()
    .from("organization_feature_flags")
    .upsert(
      {
        organization_id: organizationId,
        flag,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,flag" },
    );
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.feature_flag_changed",
    targetType: "feature_flag",
    targetId: flag,
    metadata: { enabled },
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}
