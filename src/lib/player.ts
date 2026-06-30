import type { PlayerManifest } from "@/lib/shared";
import { getEnv } from "@/lib/env";
import { serviceState } from "@/lib/entitlements";
import { signedAdUrl } from "@/lib/media";
import { isPlaylistItemActive } from "@/lib/schedule";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { bearerToken, hashToken, randomToken } from "@/lib/security";

export type DeviceAuthResult =
  | { status: "ok"; device: Record<string, any> }
  | { status: "revoked" }
  | { status: "unauthorized" };

/**
 * Resolves a device token, distinguishing an explicit remote revoke
 * (`revoked_at` set) from a generic authentication failure. Players use this
 * distinction to stay paired through transient failures and only un-pair when
 * the screen has actually been revoked from the dashboard.
 */
export async function resolveDeviceAuth(
  request: Request,
  screenCode: string,
): Promise<DeviceAuthResult> {
  const token = bearerToken(request);
  if (!token) return { status: "unauthorized" };

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("screen_devices")
    .select("*, screens!inner(id, screen_code, is_active)")
    .eq("token_hash", hashToken(token))
    .eq("screens.screen_code", screenCode.toUpperCase())
    .single();

  if (!data) return { status: "unauthorized" };
  if (data.revoked_at) return { status: "revoked" };
  return { status: "ok", device: data };
}

export async function authenticateDevice(request: Request, screenCode: string) {
  const result = await resolveDeviceAuth(request, screenCode);
  return result.status === "ok" ? result.device : null;
}

export async function createQrSession(screenId: string, screenCode: string) {
  const admin = getSupabaseAdmin();
  const token = randomToken(24);
  const expiresAt = new Date(
    Date.now() + getEnv().QR_TOKEN_TTL_SECONDS * 1000,
  ).toISOString();

  await admin.from("qr_sessions").insert({
    screen_id: screenId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });

  await admin
    .from("qr_sessions")
    .delete()
    .eq("screen_id", screenId)
    .lt("expires_at", new Date().toISOString());

  return {
    url: `${getEnv().NEXT_PUBLIC_APP_URL}/screens/${screenCode}/posts?qr=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

export async function buildManifest(
  screenCode: string,
  includeQr = true,
): Promise<PlayerManifest | null> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: screen } = await admin
    .from("screens")
    .select("*")
    .eq("screen_code", screenCode.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!screen) return null;

  const [{ data: assignments }, { data: messages }, { data: settings }, { data: organization }] =
    await Promise.all([
      admin
        .from("screen_ads")
        .select("*, ads!inner(*)")
        .eq("screen_id", screen.id)
        .eq("ads.status", "active")
        .order("sort_order"),
      admin
        .from("bulletin_messages")
        .select("*")
        .eq("screen_id", screen.id)
        .eq("status", "active")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      admin
        .from("organization_settings")
        .select("*")
        .eq("organization_id", screen.organization_id)
        .single(),
      admin
        .from("organizations")
        .select("*")
        .eq("id", screen.organization_id)
        .single(),
    ]);
  const suspended = !organization || serviceState(organization) === "suspended";
  const activeAssignments = suspended
    ? []
    : (assignments ?? []).filter((assignment: any) =>
        isPlaylistItemActive(
          assignment,
          new Date(),
          organization.timezone,
        ),
      );
  const ads = await Promise.all(
    activeAssignments.map(async (assignment: any) => ({
      id: assignment.ads.id,
      type: assignment.ads.type,
      title: assignment.ads.title,
      mediaUrl: await signedAdUrl(assignment.ads.media_path),
      duration: assignment.duration ?? assignment.ads.duration,
      sortOrder: assignment.sort_order,
      checksum: assignment.ads.checksum,
    })),
  );

  const qrCodeUrl =
    includeQr && screen.show_qr_code
      ? `${getEnv().NEXT_PUBLIC_APP_URL}/screens/${screen.screen_code}/posts`
      : null;

  return {
    schemaVersion: 1,
    serviceStatus: suspended
      ? "suspended"
      : organization.status === "grace"
        ? "grace"
        : "active",
    screenId: screen.id,
    screenCode: screen.screen_code,
    name: suspended ? "Subscription inactive" : screen.name,
    mode: suspended ? "ad_only" : screen.mode,
    layout: "fullscreen_v1",
    orientation: screen.orientation,
    contentVersion: Number(screen.current_content_version),
    generatedAt: now,
    settings: {
      showQrCode: screen.show_qr_code,
      adBlockSeconds: screen.ad_block_seconds,
      bulletinBlockSeconds: screen.bulletin_block_seconds,
      defaultMessageDuration: settings?.default_message_duration ?? 12,
    },
    ads,
    bulletin: {
      qrCodeUrl: suspended ? null : qrCodeUrl,
      messages: suspended ? [] : (messages ?? []).map((message: any) => ({
        id: message.id,
        title: message.title,
        body: message.body,
        category: message.category,
        postNumber: message.post_number,
        duration: message.duration,
        priority: message.priority,
      })),
    },
  };
}
