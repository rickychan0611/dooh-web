import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error");
  const next = url.searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (authError || !code) {
    const errorPath = destination.startsWith("/account")
      ? "/account/login?error=invalid-link"
      : "/login?error=auth-failed";
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorPath = destination.startsWith("/account")
      ? "/account/login?error=invalid-link"
      : "/login?error=auth-failed";
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
