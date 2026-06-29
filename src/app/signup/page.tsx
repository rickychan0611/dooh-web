import Link from "next/link";
import { createBusinessAccount } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="center-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">Start your 14-day trial</p>
        <h1>Create your screen workspace</h1>
        <p className="muted">No credit card. One screen included during the trial.</p>
        {params.error && <p className="notice danger">{params.error === "business-name" ? "Business name is required." : params.error}</p>}
        {params.message === "check-email" && <p className="notice success">Check your email to finish creating the workspace.</p>}
        <form action={createBusinessAccount} className="stack">
          <label>Business name<input name="organizationName" required autoComplete="organization" /></label>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <label>Country<select name="country" defaultValue="CA"><option value="CA">Canada (CAD)</option><option value="US">United States (USD)</option></select></label>
          <label>Timezone<select name="timezone" defaultValue="America/Vancouver"><option value="America/Vancouver">Pacific</option><option value="America/Edmonton">Mountain</option><option value="America/Winnipeg">Central</option><option value="America/Toronto">Eastern</option><option value="America/Halifax">Atlantic</option></select></label>
          <button className="button" type="submit">Create free trial</button>
        </form>
        <p className="muted">By continuing, you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        <Link href="/login">Already have a business account?</Link>
      </section>
    </main>
  );
}
