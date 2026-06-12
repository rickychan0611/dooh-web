import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const { data, error } = await getSupabaseAdmin()
      .from("screens")
      .select("screen_code, name, location")
      .eq("screen_code", screenCode.toUpperCase())
      .eq("is_active", true)
      .single();
    if (error || !data) return apiError("SCREEN_NOT_FOUND", "Screen not found.", 404);
    return Response.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
