import Link from "next/link";
import { signUp } from "@/app/account/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/account/profile";
  return (
    <section className="panel auth-panel account-panel">
      <p className="eyebrow">Community account</p>
      <h1>Create account</h1>
      {params.error && <p className="notice danger">{params.error}</p>}
      <form action={signUp} className="stack">
        <input type="hidden" name="next" value={next} />
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="new-password" minLength={8} /></label>
        <button className="button" type="submit">Create account</button>
      </form>
      <Link href={`/account/login?next=${encodeURIComponent(next)}`}>Already have an account?</Link>
    </section>
  );
}
