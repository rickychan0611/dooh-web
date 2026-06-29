"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClaimCodeSchema } from "@/lib/shared";
import { requireEditor, requireManager } from "@/lib/auth";
import {
  assertAd,
  assertOrganizationRecord,
  assertScreen,
  writeAudit,
} from "@/lib/authorization";
import { getOrganizationEntitlements } from "@/lib/entitlements";
import { encryptPairingToken } from "@/lib/pairing-crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken, randomToken } from "@/lib/security";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createScreen(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const access = await getOrganizationEntitlements(organizationId);
  if (access.serviceState === "suspended") {
    redirect("/dashboard/billing");
  }
  const admin = getSupabaseAdmin();
  const screenCode = text(formData, "screenCode").toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(screenCode)) {
    redirect("/dashboard/screens?error=invalid-screen-code");
  }
  if (!text(formData, "name")) {
    redirect("/dashboard/screens?error=missing-name");
  }
  const { data, error } = await admin
    .from("screens")
    .insert({
      organization_id: organizationId,
      screen_code: screenCode,
      name: text(formData, "name"),
      location: text(formData, "location") || null,
      mode: text(formData, "mode") || "ad_only",
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    redirect("/dashboard/screens?error=duplicate-screen-code");
  }
  if (error?.code === "23514") {
    redirect("/dashboard/screens?error=invalid-screen-code");
  }
  if (error?.message?.includes("SCREEN_LICENSE_LIMIT")) {
    redirect("/dashboard/screens?error=license-limit");
  }
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "screen.created",
    targetType: "screen",
    targetId: data.id,
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard/screens/${data.id}`);
}

export async function updateScreen(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const id = text(formData, "id");
  await assertScreen(id, organizationId);
  const { error } = await getSupabaseAdmin()
    .from("screens")
    .update({
      name: text(formData, "name"),
      location: text(formData, "location") || null,
      mode: text(formData, "mode"),
      show_qr_code: formData.get("showQrCode") === "on",
      public_directory_enabled: formData.get("publicDirectoryEnabled") === "on",
      ad_block_seconds: Number(text(formData, "adBlockSeconds")),
      bulletin_block_seconds: Number(text(formData, "bulletinBlockSeconds")),
      is_active: formData.get("isActive") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await getSupabaseAdmin().rpc("bump_screen_version", { target_screen: id });
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "screen.updated",
    targetType: "screen",
    targetId: id,
  });
  revalidatePath(`/dashboard/screens/${id}`);
  revalidatePath("/dashboard");
}

export async function updateCommunitySettings(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const screenId = text(formData, "id");
  await assertScreen(screenId, organizationId);
  const { error } = await getSupabaseAdmin()
    .from("screens")
    .update({
      community_access: text(formData, "communityAccess"),
      community_moderation: text(formData, "communityModeration"),
      community_attachments_allowed:
        formData.get("communityAttachmentsAllowed") === "on",
      public_directory_enabled:
        formData.get("publicDirectoryEnabled") === "on",
      show_qr_code: formData.get("showQrCode") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", screenId)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await getSupabaseAdmin().rpc("bump_screen_version", {
    target_screen: screenId,
  });
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "community.settings_updated",
    targetType: "screen",
    targetId: screenId,
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function claimPlayer(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const access = await getOrganizationEntitlements(organizationId);
  if (access.serviceState === "suspended") redirect("/dashboard/billing");
  const screenId = text(formData, "screenId");
  const returnPath = `/dashboard/screens/${screenId}`;
  const parsedCode = adminClaimCodeSchema.safeParse(formData.get("claimCode"));
  if (!parsedCode.success) redirect(`${returnPath}?pairing=invalid-format`);

  const admin = getSupabaseAdmin();
  const { data: screen } = await admin
    .from("screens")
    .select("id,is_active")
    .eq("id", screenId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!screen?.is_active) redirect(`${returnPath}?pairing=screen-inactive`);

  const deviceToken = randomToken();
  const { data, error } = await admin.rpc("claim_device_pairing_session", {
    target_screen: screen.id,
    target_code_hash: hashToken(`claim:${parsedCode.data}`),
    target_claimed_by: user.id,
    target_device_token_hash: hashToken(deviceToken),
    target_encrypted_device_token: encryptPairingToken(deviceToken),
  });
  if (error) redirect(`${returnPath}?pairing=failed`);
  const result = data?.[0]?.result;
  if (result === "rate_limited") {
    redirect(`${returnPath}?pairing=rate-limited`);
  }
  if (result === "invalid") redirect(`${returnPath}?pairing=invalid`);
  if (result === "expired") redirect(`${returnPath}?pairing=expired`);
  if (result === "claimed") redirect(`${returnPath}?pairing=claimed`);
  if (result === "screen_inactive") {
    redirect(`${returnPath}?pairing=screen-inactive`);
  }
  if (result !== "claimed_now") redirect(`${returnPath}?pairing=failed`);

  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "screen.player_paired",
    targetType: "screen",
    targetId: screen.id,
    metadata: { deviceId: data?.[0]?.paired_device_id },
  });
  revalidatePath(returnPath);
  redirect(`${returnPath}?pairing=success`);
}

export async function revokeDevice(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const screenId = text(formData, "screenId");
  await assertScreen(screenId, organizationId);
  const { error } = await getSupabaseAdmin()
    .from("screen_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", text(formData, "deviceId"))
    .eq("screen_id", screenId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "screen.player_revoked",
    targetType: "screen",
    targetId: screenId,
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function uploadAd(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Media file is required.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Media file exceeds 100 MB.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
  if (!allowed.includes(file.type)) throw new Error("Unsupported media type.");

  const admin = getSupabaseAdmin();
  const access = await getOrganizationEntitlements(organizationId);
  const { data: existingAssets } = await admin
    .from("ads")
    .select("file_size")
    .eq("organization_id", organizationId)
    .neq("status", "deleted");
  const usedBytes = (existingAssets ?? []).reduce(
    (total: number, asset: any) => total + Number(asset.file_size ?? 0),
    0,
  );
  if (usedBytes + file.size > access.storageLimitBytes) {
    throw new Error("Organization media storage quota exceeded.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const path = `${organizationId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await admin.storage
    .from("ad-media")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data: inserted, error } = await admin.from("ads").insert({
    organization_id: organizationId,
    title: text(formData, "title"),
    type: file.type.startsWith("video/") ? "video" : "image",
    media_url: `private:${path}`,
    media_path: path,
    checksum,
    duration: Number(text(formData, "duration") || 10),
    file_size: file.size,
    mime_type: file.type,
  }).select("id").single();
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "media.uploaded",
    targetType: "ad",
    targetId: inserted.id,
    metadata: { bytes: file.size, mimeType: file.type },
  });
  revalidatePath("/dashboard/ads");
  revalidatePath("/dashboard/media");
}

export async function assignAd(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const screenId = text(formData, "screenId");
  const adId = text(formData, "adId");
  await Promise.all([
    assertScreen(screenId, organizationId),
    assertAd(adId, organizationId),
  ]);
  const { error } = await getSupabaseAdmin().from("screen_ads").upsert(
    {
      screen_id: screenId,
      ad_id: adId,
      sort_order: Number(text(formData, "sortOrder") || 0),
    },
    { onConflict: "screen_id,ad_id" },
  );
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "playlist.item_assigned",
    targetType: "screen",
    targetId: screenId,
    metadata: { adId },
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function assignAdToScreens(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const adId = text(formData, "adId");
  const screenIds = [...new Set(formData.getAll("screenIds").map(String))];
  if (!screenIds.length) throw new Error("Select at least one screen.");
  await assertAd(adId, organizationId);
  await Promise.all(
    screenIds.map((screenId) => assertScreen(screenId, organizationId)),
  );
  const { error } = await getSupabaseAdmin().from("screen_ads").upsert(
    screenIds.map((screenId) => ({
      screen_id: screenId,
      ad_id: adId,
      sort_order: 999,
    })),
    { onConflict: "screen_id,ad_id" },
  );
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "media.bulk_assigned",
    targetType: "ad",
    targetId: adId,
    metadata: { screenIds },
  });
  revalidatePath("/dashboard/media");
  for (const screenId of screenIds) {
    revalidatePath(`/dashboard/screens/${screenId}`);
  }
}

export async function duplicateAd(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const adId = text(formData, "adId");
  await assertAd(adId, organizationId);
  const admin = getSupabaseAdmin();
  const { data: source, error: sourceError } = await admin
    .from("ads")
    .select(
      "title,type,media_url,media_path,checksum,duration,status,priority,file_size,mime_type,content_owner",
    )
    .eq("id", adId)
    .eq("organization_id", organizationId)
    .single();
  if (sourceError) throw sourceError;
  const { data: copy, error } = await admin
    .from("ads")
    .insert({
      ...source,
      organization_id: organizationId,
      title: `${source.title} copy`,
      // The copy references the same private object, so it consumes no new bytes.
      file_size: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "media.duplicated",
    targetType: "ad",
    targetId: copy.id,
    metadata: { sourceAdId: adId },
  });
  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard/ads");
}

export async function unassignAd(screenId: string, adId: string) {
  const { organizationId, user } = await requireEditor();
  await assertScreen(screenId, organizationId);
  const { error } = await getSupabaseAdmin()
    .from("screen_ads")
    .delete()
    .eq("screen_id", screenId)
    .eq("ad_id", adId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "playlist.item_removed",
    targetType: "screen",
    targetId: screenId,
    metadata: { adId },
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function moderateMessage(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["active", "rejected", "hidden", "deleted"].includes(status)) {
    throw new Error("Invalid moderation status.");
  }
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "active") {
    if (user.id) update.approved_by = user.id;
    update.approved_at = new Date().toISOString();
  }
  const { error } = await getSupabaseAdmin()
    .from("bulletin_messages")
    .update(update)
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: `community.post_${status}`,
    targetType: "bulletin_message",
    targetId: id,
  });
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
}

export async function resolvePostReport(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const reportId = text(formData, "reportId");
  const status = text(formData, "status");
  if (!["resolved", "dismissed"].includes(status)) {
    throw new Error("Invalid report status.");
  }
  await assertOrganizationRecord("post_reports", reportId, organizationId);
  const { error } = await getSupabaseAdmin()
    .from("post_reports")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", reportId)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: `community.report_${status}`,
    targetType: "post_report",
    targetId: reportId,
  });
  revalidatePath("/dashboard/messages");
}

export async function createStaffPost(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const screenId = text(formData, "screenId");
  await assertScreen(screenId, organizationId);
  const admin = getSupabaseAdmin();
  const { data: settings } = await admin
    .from("organization_settings")
    .select("default_message_duration")
    .eq("organization_id", organizationId)
    .single();
  const { data: postNumber, error: numberError } = await admin.rpc(
    "allocate_post_number",
    { target_screen: screenId },
  );
  if (numberError) throw numberError;
  const { data: post, error } = await admin
    .from("bulletin_messages")
    .insert({
      organization_id: organizationId,
      screen_id: screenId,
      post_number: postNumber,
      user_id: user.id,
      category: text(formData, "category") || "announcements",
      title: text(formData, "title").slice(0, 80),
      body: text(formData, "body").slice(0, 2000),
      submitter_name: text(formData, "submitterName") || "Screen team",
      submitter_fingerprint: `staff:${user.id}`,
      source: "remote",
      status: "active",
      duration: Number(settings?.default_message_duration ?? 12),
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      starts_at: text(formData, "startsAt") || null,
      ends_at: text(formData, "endsAt") || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "community.post_created_by_staff",
    targetType: "bulletin_message",
    targetId: post.id,
    metadata: { screenId },
  });
  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function updateSettings(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const blockedWords = text(formData, "blockedWords")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const { error } = await getSupabaseAdmin()
    .from("organization_settings")
    .update({
      default_message_duration: Number(text(formData, "defaultMessageDuration")),
      blocked_words: blockedWords,
      per_submitter_limit: Number(text(formData, "perSubmitterLimit")),
      per_submitter_window_minutes: Number(text(formData, "perSubmitterWindowMinutes")),
      per_screen_hour_limit: Number(text(formData, "perScreenHourLimit")),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  if (error) throw error;
  const timezone = text(formData, "timezone");
  if (timezone) {
    const { error: organizationError } = await getSupabaseAdmin()
      .from("organizations")
      .update({ timezone, updated_at: new Date().toISOString() })
      .eq("id", organizationId);
    if (organizationError) throw organizationError;
  }
  const { data: screens } = await getSupabaseAdmin()
    .from("screens")
    .select("id")
    .eq("organization_id", organizationId);
  await Promise.all(
    (screens ?? []).map((screen: any) =>
      getSupabaseAdmin().rpc("bump_screen_version", {
        target_screen: screen.id,
      }),
    ),
  );
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "organization.settings_updated",
    targetType: "organization",
    targetId: organizationId,
  });
  revalidatePath("/dashboard/settings");
}

export async function savePlaylistItem(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const screenId = text(formData, "screenId");
  const adId = text(formData, "adId");
  await Promise.all([
    assertScreen(screenId, organizationId),
    assertAd(adId, organizationId),
  ]);
  const weekdays = formData
    .getAll("weekdays")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const { error } = await getSupabaseAdmin()
    .from("screen_ads")
    .update({
      sort_order: Number(text(formData, "sortOrder") || 0),
      duration: Number(text(formData, "duration") || 0) || null,
      is_active: formData.get("isActive") === "on",
      starts_at: text(formData, "startsAt") || null,
      ends_at: text(formData, "endsAt") || null,
      weekdays: weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6],
      start_time: text(formData, "startTime") || null,
      end_time: text(formData, "endTime") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("screen_id", screenId)
    .eq("ad_id", adId);
  if (error) throw error;
  await getSupabaseAdmin().rpc("bump_screen_version", {
    target_screen: screenId,
  });
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "playlist.item_updated",
    targetType: "screen",
    targetId: screenId,
    metadata: { adId },
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function savePlaylist(formData: FormData) {
  const { organizationId, user } = await requireEditor();
  const screenId = text(formData, "screenId");
  await assertScreen(screenId, organizationId);
  const raw = text(formData, "items");
  const items = JSON.parse(raw) as Array<{
    adId: string;
    sortOrder: number;
    duration: number | null;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    weekdays: number[];
    startTime: string | null;
    endTime: string | null;
  }>;
  const allowedAds = await Promise.all(
    items.map((item) => assertAd(item.adId, organizationId)),
  );
  if (allowedAds.length !== items.length) {
    throw new Error("Playlist contains unavailable media.");
  }
  const admin = getSupabaseAdmin();
  for (const [index, item] of items.entries()) {
    const { error } = await admin
      .from("screen_ads")
      .update({
        sort_order: index,
        duration:
          item.duration && item.duration > 0 ? Math.trunc(item.duration) : null,
        is_active: Boolean(item.isActive),
        starts_at: item.startsAt || null,
        ends_at: item.endsAt || null,
        weekdays:
          item.weekdays?.filter((day) => day >= 0 && day <= 6) ?? [
            0, 1, 2, 3, 4, 5, 6,
          ],
        start_time: item.startTime || null,
        end_time: item.endTime || null,
        updated_at: new Date().toISOString(),
      })
      .eq("screen_id", screenId)
      .eq("ad_id", item.adId);
    if (error) throw error;
  }
  await admin.rpc("bump_screen_version", { target_screen: screenId });
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "playlist.saved",
    targetType: "screen",
    targetId: screenId,
    metadata: { itemCount: items.length },
  });
  revalidatePath(`/dashboard/screens/${screenId}`);
}
