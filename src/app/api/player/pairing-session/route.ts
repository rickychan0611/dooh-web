import { randomInt } from "node:crypto";
import {
  createPairingSessionRequestSchema,
  createPairingSessionResponseSchema,
} from "@dooh/shared";
import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken, randomToken } from "@/lib/security";

function createClaimCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(request: Request) {
  try {
    const input = createPairingSessionRequestSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    const { error: cleanupError } = await admin.rpc(
      "cleanup_device_pairing_sessions",
    );
    if (cleanupError) throw cleanupError;
    await admin
      .from("device_pairing_sessions")
      .delete()
      .eq("device_id", input.deviceId)
      .eq("status", "pending");

    const { data: count, error: countError } = await admin.rpc(
      "recent_device_pairing_session_count",
      { target_device_id: input.deviceId },
    );
    if (countError) throw countError;
    if ((count ?? 0) >= 20) {
      return apiError(
        "PAIRING_RATE_LIMIT",
        "Too many pairing sessions. Please wait and try again.",
        429,
      );
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const claimCode = createClaimCode();
      const pollToken = randomToken();
      const { data, error } = await admin
        .from("device_pairing_sessions")
        .insert({
          device_id: input.deviceId,
          app_version: input.appVersion,
          claim_code_hash: hashToken(`claim:${claimCode}`),
          poll_token_hash: hashToken(`poll:${pollToken}`),
        })
        .select("expires_at")
        .single();
      if (!error) {
        return Response.json(
          createPairingSessionResponseSchema.parse({
            claimCode,
            pollToken,
            expiresAt: new Date(data.expires_at).toISOString(),
          }),
          { status: 201 },
        );
      }
      if (error.code !== "23505") throw error;
    }

    return apiError(
      "PAIRING_CODE_UNAVAILABLE",
      "Could not create a pairing code. Please try again.",
      503,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
