import { handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("screens")
      .select("screen_code, name, location")
      .eq("is_active", true)
      .eq("public_directory_enabled", true)
      .order("name");
    if (error) throw error;
    return Response.json({ screens: data });
  } catch (error) {
    return handleApiError(error);
  }
}
