import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

async function context(request: Request) {
  const {
    data: { user },
  } = await (await getSupabaseServer()).auth.getUser();
  if (!user) return { error: apiError("AUTH_REQUIRED", "Sign in first.", 401) };
  const input = await request.json();
  if (typeof input.postId !== "string") {
    return { error: apiError("VALIDATION_ERROR", "Post ID is required.", 422) };
  }
  return { user, postId: input.postId };
}

export async function POST(request: Request) {
  try {
    const result = await context(request);
    if ("error" in result) return result.error;
    const admin = getSupabaseAdmin();
    const { data: post } = await admin
      .from("bulletin_messages")
      .select("id")
      .eq("id", result.postId)
      .eq("status", "active")
      .maybeSingle();
    if (!post) return apiError("POST_NOT_FOUND", "Post not found.", 404);
    const { error } = await admin.from("saved_posts").upsert({
      user_id: result.user.id,
      post_id: result.postId,
    });
    if (error) throw error;
    return Response.json({ saved: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await context(request);
    if ("error" in result) return result.error;
    const { error } = await getSupabaseAdmin()
      .from("saved_posts")
      .delete()
      .eq("user_id", result.user.id)
      .eq("post_id", result.postId);
    if (error) throw error;
    return Response.json({ saved: false });
  } catch (error) {
    return handleApiError(error);
  }
}
