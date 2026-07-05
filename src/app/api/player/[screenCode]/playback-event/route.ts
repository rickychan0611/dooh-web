import { adPlaybackEventSchema } from "@/lib/shared";
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
    const input = adPlaybackEventSchema.parse(await request.json());
    if (input.deviceId !== device.device_id) {
      return apiError("DEVICE_MISMATCH", "Device identity does not match token.", 403);
    }

    const admin = getSupabaseAdmin();
    const { data: ad } = await admin
      .from("ads")
      .select("id,organization_id")
      .eq("id", input.adId)
      .maybeSingle();
    const { data: screen } = await admin
      .from("screens")
      .select("id,organization_id")
      .eq("id", device.screen_id)
      .maybeSingle();
    if (!ad || !screen || ad.organization_id !== screen.organization_id) {
      return apiError("AD_NOT_FOUND", "Ad is not available for this screen.", 404);
    }

    const { error } = await admin.from("ad_playback_events").insert({
      organization_id: screen.organization_id,
      screen_id: device.screen_id,
      device_id: device.id,
      player_device_id: input.deviceId,
      ad_id: input.adId,
      event_type: input.eventType,
      content_version: input.contentVersion,
      occurred_at: input.occurredAt,
      duration_seconds: input.durationSeconds ?? null,
    });
    if (error) throw error;
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
