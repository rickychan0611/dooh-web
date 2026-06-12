import Link from "next/link";
import { signIn } from "@/app/account/actions";

export default async function PublicLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/account";
  return (
    <section className="panel auth-panel account-panel">
      <p className="eyebrow">Community account</p>
      <h1>Sign in</h1>
      {params.error && <p className="notice danger">Email or password is incorrect.</p>}
      {params.message === "check-email" && <p className="notice">Check your email before signing in.</p>}
      <form action={signIn} className="stack">
        <input type="hidden" name="next" value={next} />
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" minLength={8} /></label>
        <button className="button" type="submit">Sign in</button>
      </form>
      <div className="auth-links">
        <Link href={`/account/signup?next=${encodeURIComponent(next)}`}>Create account</Link>
        <Link href="/account/forgot-password">Forgot password?</Link>
      </div>
    </section>
  );
}
