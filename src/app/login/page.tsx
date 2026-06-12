import Link from "next/link";
import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { sendMagicLink } from "./actions";

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
          Enter the allowlisted owner email. Supabase will send a secure magic
          link.
        </p>
        {params.sent && <p className="notice success">Check your inbox.</p>}
        {params.error === "not-allowed" && (
          <p className="notice danger">
            That email cannot access this dashboard.
          </p>
        )}
        {params.error === "send-failed" && (
          <p className="notice danger">
            The magic link could not be sent. Please try again.
          </p>
        )}
        {params.error === "invalid-link" && (
          <p className="notice danger">
            This magic link is invalid or expired. Request a new link and open
            only the newest email.
          </p>
        )}
        <form action={sendMagicLink} className="stack">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button className="button" type="submit">
            Send magic link
          </button>
        </form>
        <Link href="/screens">View public screens</Link>
      </section>
    </main>
  );
}
