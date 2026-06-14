import { playerErrorRequestSchema } from "@/lib/shared";
import { apiError, handleApiError } from "@/lib/http";
import { authenticateDevice } from "@/lib/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const device = await authenticateDevice(request, screenCode);
    if (!device) return apiError("UNAUTHORIZED", "Invalid device token.", 401);
    const input = playerErrorRequestSchema.parse(await request.json());

    const { error } = await getSupabaseAdmin().from("player_errors").insert({
      screen_id: device.screen_id,
      device_id: input.deviceId,
      error_type: input.errorType,
      error_message: input.errorMessage,
      details: input.details ?? {},
      occurred_at: input.occurredAt,
    });
    if (error) throw error;
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
