"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateCommunityMember(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const memberUserId = text(formData, "userId");
  const status = text(formData, "status");
  if (!["active", "trusted", "suspended", "banned"].includes(status)) {
    throw new Error("Invalid community status.");
  }
  const { error } = await getSupabaseAdmin()
    .from("community_members")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("user_id", memberUserId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "community.member_updated",
    targetType: "user",
    targetId: memberUserId,
    metadata: { status },
  });
  revalidatePath("/dashboard/community");
}
