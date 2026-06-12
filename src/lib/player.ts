import type { PlayerManifest } from "@dooh/shared";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { bearerToken, hashToken, randomToken } from "@/lib/security";

export async function authenticateDevice(request: Request, screenCode: string) {
  const token = bearerToken(request);
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("screen_devices")
    .select("*, screens!inner(id, screen_code, is_active)")
    .eq("token_hash", hashToken(token))
    .eq("screens.screen_code", screenCode.toUpperCase())
    .is("revoked_at", null)
    .single();

  return data ?? null;
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

  const [{ data: assignments }, { data: messages }, { data: settings }] =
    await Promise.all([
      admin
        .from("screen_ads")
        .select("sort_order, ads!inner(*)")
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
    ]);

  const qrCodeUrl =
    includeQr && screen.show_qr_code
      ? `${getEnv().NEXT_PUBLIC_APP_URL}/screens/${screen.screen_code}/posts`
      : null;

  return {
    schemaVersion: 1,
    screenId: screen.id,
    screenCode: screen.screen_code,
    name: screen.name,
    mode: screen.mode,
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
    ads: (assignments ?? []).map((assignment: any) => ({
      id: assignment.ads.id,
      type: assignment.ads.type,
      title: assignment.ads.title,
      mediaUrl: assignment.ads.media_url,
      duration: assignment.ads.duration,
      sortOrder: assignment.sort_order,
      checksum: assignment.ads.checksum,
    })),
    bulletin: {
      qrCodeUrl,
      messages: (messages ?? []).map((message: any) => ({
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
