import { handleApiError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serviceState } from "@/lib/entitlements";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("screens")
      .select("screen_code, name, location, community_access, organizations!inner(*)")
      .eq("is_active", true)
      .eq("public_directory_enabled", true)
      .neq("community_access", "disabled")
      .order("name");
    if (error) throw error;
    const screens = (data ?? [])
      .filter((screen: any) => serviceState(screen.organizations) !== "suspended")
      .map((screen: any) => ({
        screen_code: screen.screen_code,
        name: screen.name,
        location: screen.location,
      }));
    return Response.json({ screens });
  } catch (error) {
    return handleApiError(error);
  }
}
