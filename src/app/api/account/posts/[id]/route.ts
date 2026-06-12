import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const {
      data: { user },
    } = await (await getSupabaseServer()).auth.getUser();
    if (!user) return apiError("AUTH_REQUIRED", "Sign in first.", 401);
    const { id } = await params;
    const admin = getSupabaseAdmin();
    const { data: post } = await admin
      .from("bulletin_messages")
      .select("id,media_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!post) return apiError("POST_NOT_FOUND", "Post not found.", 404);
    const { error } = await admin
      .from("bulletin_messages")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("user_id", user.id);
    if (error) throw error;
    await admin.from("saved_posts").delete().eq("post_id", post.id);
    if (post.media_path) {
      await admin.storage.from("bulletin-media").remove([post.media_path]);
      await admin.from("bulletin_messages").update({
        media_path: null,
        media_url: null,
        media_type: null,
        media_mime_type: null,
        media_file_size: null,
      }).eq("id", post.id);
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
