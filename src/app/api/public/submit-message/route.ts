import { publicSubmissionSchema } from "@dooh/shared";
import { apiError, handleApiError } from "@/lib/http";
import {
  containsBlockedWord,
  enforceSubmissionLimits,
  verifyQrToken,
} from "@/lib/moderation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const input = publicSubmissionSchema.parse({
      screenCode: form.get("screenCode"),
      title: form.get("title"),
      body: form.get("body"),
      category: form.get("category"),
      submitterName: form.get("submitterName") || undefined,
      submitterContact: form.get("submitterContact") || undefined,
      showContactPublicly: form.get("showContactPublicly") === "true",
      agreement: form.get("agreement") === "true",
      qrToken: form.get("qrToken") || undefined,
    });
    const media = form.get("media");
    const mediaFile = media instanceof File && media.size > 0 ? media : null;
    const allowedMediaTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
    if (mediaFile && mediaFile.size > 20 * 1024 * 1024) {
      return apiError("MEDIA_TOO_LARGE", "Media must be 20 MB or smaller.", 413);
    }
    if (mediaFile && !allowedMediaTypes.includes(mediaFile.type)) {
      return apiError("MEDIA_TYPE_INVALID", "Unsupported media type.", 422);
    }

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("AUTH_REQUIRED", "Sign in to create a post.", 401);

    const admin = getSupabaseAdmin();
    const { data: screen } = await admin
      .from("screens")
      .select("id, organization_id, screen_code, is_active")
      .eq("screen_code", input.screenCode.toUpperCase())
      .single();
    if (!screen?.is_active) return apiError("SCREEN_NOT_FOUND", "Screen not found.", 404);

    const { data: settings } = await admin
      .from("organization_settings")
      .select("*")
      .eq("organization_id", screen.organization_id)
      .single();
    if (
      containsBlockedWord(input.title, input.body, settings?.blocked_words ?? [])
    ) {
      return apiError(
        "CONTENT_BLOCKED",
        "This message contains content that cannot be displayed.",
        422,
      );
    }

    let submitterFingerprint: string;
    try {
      submitterFingerprint = await enforceSubmissionLimits({
        screenId: screen.id,
        rawFingerprint: user.id,
        title: input.title,
        body: input.body,
        perSubmitterLimit: settings?.per_submitter_limit ?? 3,
        perSubmitterWindowMinutes:
          settings?.per_submitter_window_minutes ?? 10,
        perScreenHourLimit: settings?.per_screen_hour_limit ?? 10,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "RATE_LIMIT";
      return apiError(code, "Please wait before submitting another message.", 429);
    }

    const onsite = await verifyQrToken(screen.id, input.qrToken);
    const status = onsite ? "active" : "pending";
    const messageId = crypto.randomUUID();
    const { data: postNumber, error: numberError } = await admin.rpc(
      "allocate_post_number",
      { target_screen: screen.id },
    );
    if (numberError) throw numberError;
    let mediaRecord: {
      media_url: null;
      media_path: string;
      media_type: "image" | "video";
      media_mime_type: string;
      media_file_size: number;
    } | null = null;

    if (mediaFile) {
      const safeName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const mediaPath = `${screen.organization_id}/${messageId}/${safeName}`;
      const { error: uploadError } = await admin.storage
        .from("bulletin-media")
        .upload(mediaPath, new Uint8Array(await mediaFile.arrayBuffer()), {
          contentType: mediaFile.type,
          upsert: false,
      });
      if (uploadError) throw uploadError;
      mediaRecord = {
        media_url: null,
        media_path: mediaPath,
        media_type: mediaFile.type.startsWith("video/") ? "video" : "image",
        media_mime_type: mediaFile.type,
        media_file_size: mediaFile.size,
      };
    }

    const { data: message, error } = await admin
      .from("bulletin_messages")
      .insert({
        id: messageId,
        post_number: postNumber,
        user_id: user.id,
        organization_id: screen.organization_id,
        screen_id: screen.id,
        category: input.category,
        title: input.title,
        body: input.body,
        submitter_name: input.submitterName || null,
        submitter_contact: input.submitterContact || null,
        show_contact_publicly: input.showContactPublicly,
        submitter_fingerprint: submitterFingerprint,
        source: onsite ? "onsite" : "remote",
        status,
        duration: settings?.default_message_duration ?? 12,
        approved_at: onsite ? new Date().toISOString() : null,
        ...mediaRecord,
      })
      .select("id")
      .single();
    if (error) {
      if (mediaRecord) {
        await admin.storage.from("bulletin-media").remove([mediaRecord.media_path]);
      }
      throw error;
    }
    return Response.json(
      { id: message.id, postNumber, status, publishedImmediately: onsite },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
