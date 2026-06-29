import { apiError, handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serviceState } from "@/lib/entitlements";

export async function GET(
  _request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const { data, error } = await getSupabaseAdmin()
      .from("screens")
      .select("screen_code, name, location, community_access, organizations!inner(*)")
      .eq("screen_code", screenCode.toUpperCase())
      .eq("is_active", true)
      .single();
    if (
      error ||
      !data ||
      data.community_access === "disabled" ||
      serviceState(data.organizations) === "suspended"
    ) return apiError("SCREEN_NOT_FOUND", "Screen not found.", 404);
    return Response.json({
      screen_code: data.screen_code,
      name: data.name,
      location: data.location,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
