import {
  pairingSessionStatusRequestSchema,
  pairingSessionStatusResponseSchema,
} from "@/lib/shared";
import { apiError, handleApiError } from "@/lib/http";
import { decryptPairingToken } from "@/lib/pairing-crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const input = pairingSessionStatusRequestSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc(
      "get_device_pairing_session_status",
      { target_poll_token_hash: hashToken(`poll:${input.pollToken}`) },
    );
    if (error) throw error;
    const session = data?.[0];
    if (!session) {
      return apiError("PAIRING_SESSION_NOT_FOUND", "Pairing session not found.", 404);
    }
    if (session.status === "expired") {
      return Response.json(
        pairingSessionStatusResponseSchema.parse({ status: "expired" }),
      );
    }
    if (
      session.status === "claimed" &&
      session.assigned_screen_id &&
      session.encrypted_device_token &&
      session.screen_code
    ) {
      return Response.json(
        pairingSessionStatusResponseSchema.parse({
          status: "claimed",
          screenId: session.assigned_screen_id,
          screenCode: session.screen_code,
          deviceToken: decryptPairingToken(session.encrypted_device_token),
        }),
      );
    }
    return Response.json(
      pairingSessionStatusResponseSchema.parse({
        status: "pending",
        expiresAt: session.expires_at,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
