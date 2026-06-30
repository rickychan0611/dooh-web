import { heartbeatRequestSchema } from "@/lib/shared";
import { apiError, handleApiError } from "@/lib/http";
import { resolveDeviceAuth } from "@/lib/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const auth = await resolveDeviceAuth(request, screenCode);
    if (auth.status === "revoked") {
      return apiError("DEVICE_REVOKED", "This screen has been unpaired.", 403);
    }
    if (auth.status !== "ok") {
      return apiError("UNAUTHORIZED", "Invalid device token.", 401);
    }
    const device = auth.device;
    const input = heartbeatRequestSchema.parse(await request.json());
    if (input.deviceId !== device.device_id) {
      return apiError("DEVICE_MISMATCH", "Device identity does not match token.", 403);
    }

    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();
    const [{ error: deviceError }, { error: screenError }] = await Promise.all([
      admin
        .from("screen_devices")
        .update({
          app_version: input.appVersion,
          last_seen_at: now,
          last_sync_at: input.lastSyncAt,
          content_version: input.contentVersion,
          current_item_id: input.currentItemId,
          free_storage_mb: input.freeStorageMb,
          last_error: input.error,
          updated_at: now,
        })
        .eq("id", device.id),
      admin
        .from("screens")
        .update({ last_heartbeat_at: now })
        .eq("id", device.screen_id),
    ]);
    if (deviceError || screenError) throw deviceError ?? screenError;
    return Response.json({ ok: true, serverTime: now });
  } catch (error) {
    return handleApiError(error);
  }
}
