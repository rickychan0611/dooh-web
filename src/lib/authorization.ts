import type { OrganizationRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function assertOrganizationRecord(
  table: string,
  id: string,
  organizationId: string,
) {
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select("id,organization_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Record not found in this organization.");
  return data;
}

export async function assertScreen(
  screenId: string,
  organizationId: string,
) {
  return assertOrganizationRecord("screens", screenId, organizationId);
}

export async function assertAd(adId: string, organizationId: string) {
  return assertOrganizationRecord("ads", adId, organizationId);
}

export async function writeAudit(input: {
  organizationId: string;
  actorUserId?: string | null;
  actorType?: "user" | "platform" | "system" | "stripe" | "player";
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId ?? null,
    actor_type: input.actorType ?? "user",
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export function canEdit(role: OrganizationRole) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function canManage(role: OrganizationRole) {
  return role === "owner" || role === "admin";
}
