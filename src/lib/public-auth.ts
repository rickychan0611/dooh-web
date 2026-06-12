import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function getPublicUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requirePublicUser(returnTo = "/account") {
  const user = await getPublicUser();
  if (!user) {
    redirect(`/account/login?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

export function safeReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
