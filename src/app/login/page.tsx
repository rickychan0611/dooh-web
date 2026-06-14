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
        <h1>Admin sign in</h1>
        <p className="muted">
          Sign in with the allowlisted owner email and password.
        </p>
        {params.error === "not-allowed" && (
          <p className="notice danger">
            That email cannot access this dashboard.
          </p>
        )}
        {params.error === "invalid-credentials" && (
          <p className="notice danger">Email or password is incorrect.</p>
        )}
        {params.error === "auth-failed" && (
          <p className="notice danger">
            Authentication failed. Please sign in again.
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
        <Link href="/screens">View public screens</Link>
      </section>
    </main>
  );
}
