import { playerDeviceCommandSchema } from "@/lib/shared";
import { apiError, handleApiError } from "@/lib/http";
import { resolveDeviceAuth } from "@/lib/player";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const KEEP_ACTIVE_INTERVAL_MS = 10 * 60_000;

function jsonCommand(command: {
  id: string;
  command: string;
  expires_at: string;
  screen_id: string;
  screen_device_id: string;
}) {
  return Response.json(
    playerDeviceCommandSchema.parse({
      id: command.id,
      command: command.command,
      expiresAt: new Date(command.expires_at).toISOString(),
    }),
  );
}

async function queueKeepActiveCommand(
  admin: ReturnType<typeof getSupabaseAdmin>,
  device: { id: string; screen_id: string; claimed_by?: string | null },
) {
  const { data: screen } = await admin
    .from("screens")
    .select("organization_id,cec_keep_active_enabled")
    .eq("id", device.screen_id)
    .maybeSingle();
  if (!screen?.cec_keep_active_enabled) return null;

  const now = Date.now();
  const { data: inFlight } = await admin
    .from("screen_device_commands")
    .select("id")
    .eq("screen_device_id", device.id)
    .in("status", ["queued", "running"])
    .gt("expires_at", new Date(now).toISOString())
    .limit(1)
    .maybeSingle();
  if (inFlight) return null;

  const { data: lastKeepActive } = await admin
    .from("screen_device_commands")
    .select("created_at")
    .eq("screen_device_id", device.id)
    .eq("command", "cec_activate_player")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    lastKeepActive &&
    now - new Date(lastKeepActive.created_at).getTime() < KEEP_ACTIVE_INTERVAL_MS
  ) {
    return null;
  }

  const expiresAt = new Date(now + 60_000).toISOString();
  const { error } = await admin.from("screen_device_commands").insert({
    organization_id: screen.organization_id,
    screen_id: device.screen_id,
    screen_device_id: device.id,
    requested_by: device.claimed_by || null,
    command: "cec_activate_player",
    expires_at: expiresAt,
  });
  if (error) throw error;

  const { data, error: claimError } = await admin.rpc(
    "claim_next_screen_device_command",
    { target_device: device.id },
  );
  if (claimError) throw claimError;
  return data?.[0] ?? null;
}

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

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc(
      "claim_next_screen_device_command",
      { target_device: auth.device.id },
    );
    if (error) throw error;
    let command = data?.[0];
    if (!command) {
      command = await queueKeepActiveCommand(admin, {
        id: String(auth.device.id),
        screen_id: String(auth.device.screen_id),
        claimed_by: auth.device.claimed_by ?? null,
      });
    }
    if (!command) return new Response(null, { status: 204 });
    if (
      command.screen_id !== auth.device.screen_id ||
      command.screen_device_id !== auth.device.id
    ) {
      return apiError("COMMAND_MISMATCH", "Command does not belong to this device.", 403);
    }

    return jsonCommand(command);
  } catch (error) {
    return handleApiError(error);
  }
}
