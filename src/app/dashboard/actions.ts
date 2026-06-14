"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClaimCodeSchema } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";
import { encryptPairingToken } from "@/lib/pairing-crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken, randomToken } from "@/lib/security";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createScreen(formData: FormData) {
  const { organizationId } = await requireAdmin();
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
  if (error) throw error;
  revalidatePath("/dashboard");
  redirect(`/dashboard/screens/${data.id}`);
}

export async function updateScreen(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await getSupabaseAdmin().rpc("bump_screen_version", { target_screen: id });
  revalidatePath(`/dashboard/screens/${id}`);
  revalidatePath("/dashboard");
}

export async function claimPlayer(formData: FormData) {
  const { organizationId, user } = await requireAdmin();
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
  if (error) throw error;
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

  revalidatePath(returnPath);
  redirect(`${returnPath}?pairing=success`);
}

export async function revokeDevice(formData: FormData) {
  await requireAdmin();
  const screenId = text(formData, "screenId");
  const { error } = await getSupabaseAdmin()
    .from("screen_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", text(formData, "deviceId"));
  if (error) throw error;
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function uploadAd(formData: FormData) {
  const { organizationId } = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Media file is required.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Media file exceeds 100 MB.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
  if (!allowed.includes(file.type)) throw new Error("Unsupported media type.");

  const admin = getSupabaseAdmin();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const path = `${organizationId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await admin.storage
    .from("ad-media")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = admin.storage.from("ad-media").getPublicUrl(path);

  const { error } = await admin.from("ads").insert({
    organization_id: organizationId,
    title: text(formData, "title"),
    type: file.type.startsWith("video/") ? "video" : "image",
    media_url: publicUrl.publicUrl,
    media_path: path,
    checksum,
    duration: Number(text(formData, "duration") || 10),
    file_size: file.size,
    mime_type: file.type,
  });
  if (error) throw error;
  revalidatePath("/dashboard/ads");
  revalidatePath("/dashboard/media");
}

export async function assignAd(formData: FormData) {
  await requireAdmin();
  const screenId = text(formData, "screenId");
  const { error } = await getSupabaseAdmin().from("screen_ads").upsert(
    {
      screen_id: screenId,
      ad_id: text(formData, "adId"),
      sort_order: Number(text(formData, "sortOrder") || 0),
    },
    { onConflict: "screen_id,ad_id" },
  );
  if (error) throw error;
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function unassignAd(formData: FormData) {
  await requireAdmin();
  const screenId = text(formData, "screenId");
  const { error } = await getSupabaseAdmin()
    .from("screen_ads")
    .delete()
    .eq("screen_id", screenId)
    .eq("ad_id", text(formData, "adId"));
  if (error) throw error;
  revalidatePath(`/dashboard/screens/${screenId}`);
}

export async function moderateMessage(formData: FormData) {
  const { user } = await requireAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
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
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
}

export async function updateSettings(formData: FormData) {
  const { organizationId } = await requireAdmin();
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
  revalidatePath("/dashboard/settings");
}
