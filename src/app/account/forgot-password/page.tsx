import { requestPasswordReset } from "@/app/account/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <section className="panel auth-panel account-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Reset password</h1>
      {sent && <p className="notice success">Check your email for the reset link.</p>}
      <form action={requestPasswordReset} className="stack">
        <label>Email<input name="email" type="email" required /></label>
        <button className="button" type="submit">Send reset link</button>
      </form>
    </section>
  );
}
