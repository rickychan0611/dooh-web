import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

function safeRedirectPath(
  value: string | null,
  fallback: string,
): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error");
  const nextParam = url.searchParams.get("next");
  const destination = safeRedirectPath(nextParam, "/account/reset-password");

  if (authError || !code) {
    const errorPath = destination.startsWith("/account")
      ? "/account/login?error=invalid-link"
      : "/login?error=auth-failed";
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(destination, url.origin));
  const env = getEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorPath = destination.startsWith("/account")
      ? "/account/login?error=invalid-link"
      : "/login?error=auth-failed";
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  return redirectResponse;
}
