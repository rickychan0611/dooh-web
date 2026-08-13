import { requireManager } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; commandId: string }> },
) {
  try {
    const { organizationId } = await requireManager();
    const { id, commandId } = await context.params;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("screen_device_commands")
      .select("id,command,status,result,error_message,created_at,claimed_at,completed_at,expires_at")
      .eq("id", commandId)
      .eq("screen_id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError("COMMAND_NOT_FOUND", "Command was not found.", 404);

    if (
      ["queued", "running"].includes(data.status) &&
      new Date(data.expires_at).getTime() <= Date.now()
    ) {
      const now = new Date().toISOString();
      const { data: expired, error: expireError } = await admin
        .from("screen_device_commands")
        .update({ status: "expired", completed_at: now, updated_at: now })
        .eq("id", data.id)
        .in("status", ["queued", "running"])
        .select("id,command,status,result,error_message,created_at,claimed_at,completed_at,expires_at")
        .maybeSingle();
      if (expireError) throw expireError;
      return Response.json(expired ?? { ...data, status: "expired", completed_at: now });
    }

    return Response.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
