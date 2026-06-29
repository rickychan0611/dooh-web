import Link from "next/link";
import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isDevAuthBypassEnabled()) redirect("/dashboard");

  const params = await searchParams;
  return (
    <main className="center-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">DOOH Control Room</p>
        <h1>Business sign in</h1>
        <p className="muted">
          Manage your screens, promotions, and community board.
        </p>
        {params.error === "invalid-credentials" && (
          <p className="notice danger">Email or password is incorrect.</p>
        )}
        {params.error === "auth-failed" && (
          <p className="notice danger">
            Authentication failed. Please sign in again.
          </p>
        )}
        {params.error === "auth-unavailable" && (
          <p className="notice danger">
            Could not reach the authentication service. Check your Supabase
            configuration in .env.local.
          </p>
        )}
        {params.message === "password-updated" && (
          <p className="notice success">
            Password updated. Sign in with your new password.
          </p>
        )}
        <form action={signIn} className="stack">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </label>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
        <div className="auth-links">
          <Link href="/signup">Start a free trial</Link>
          <Link href="/account/forgot-password">Forgot password?</Link>
        </div>
      </section>
    </main>
  );
}
