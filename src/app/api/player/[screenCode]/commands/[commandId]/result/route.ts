import { playerDeviceCommandResultSchema } from "@/lib/shared";
import { apiError, handleApiError } from "@/lib/http";
import { resolveDeviceAuth } from "@/lib/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function boundedResult(result: Record<string, unknown>) {
  const serialized = JSON.stringify(result);
  if (serialized.length <= 4000) return result;
  return {
    truncated: true,
    output: serialized.slice(0, 3900),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ screenCode: string; commandId: string }> },
) {
  try {
    const { screenCode, commandId } = await context.params;
    const auth = await resolveDeviceAuth(request, screenCode);
    if (auth.status === "revoked") {
      return apiError("DEVICE_REVOKED", "This screen has been unpaired.", 403);
    }
    if (auth.status !== "ok") {
      return apiError("UNAUTHORIZED", "Invalid device token.", 401);
    }

    const input = playerDeviceCommandResultSchema.parse(await request.json());
    if (input.deviceId !== auth.device.device_id) {
      return apiError("DEVICE_MISMATCH", "Device identity does not match token.", 403);
    }

    const admin = getSupabaseAdmin();
    const { data: command, error: readError } = await admin
      .from("screen_device_commands")
      .select("id,status,screen_id,screen_device_id")
      .eq("id", commandId)
      .eq("screen_id", auth.device.screen_id)
      .eq("screen_device_id", auth.device.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!command) return apiError("COMMAND_NOT_FOUND", "Command was not found.", 404);
    if (["succeeded", "failed"].includes(command.status)) {
      return Response.json({ ok: true, duplicate: true });
    }
    if (command.status !== "running") {
      return apiError("COMMAND_NOT_RUNNING", "Command is no longer running.", 409);
    }

    const { data: updated, error: updateError } = await admin
      .from("screen_device_commands")
      .update({
        status: input.success ? "succeeded" : "failed",
        result: boundedResult(input.result),
        error_message: input.error ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commandId)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return apiError("COMMAND_CONFLICT", "Command status changed.", 409);
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
