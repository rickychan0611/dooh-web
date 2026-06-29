import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.pathname === "/auth/callback") {
    return NextResponse.next();
  }

  const callbackUrl = request.nextUrl.clone();
  callbackUrl.pathname = "/auth/callback";
  if (!callbackUrl.searchParams.get("next")) {
    callbackUrl.searchParams.set("next", "/account/reset-password");
  }

  return NextResponse.redirect(callbackUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
