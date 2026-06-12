import { updatePassword } from "@/app/account/actions";
import { requirePublicUser } from "@/lib/public-auth";

export default async function ResetPasswordPage() {
  await requirePublicUser("/account/reset-password");
  return (
    <section className="panel auth-panel account-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      <form action={updatePassword} className="stack">
        <label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <button className="button" type="submit">Update password</button>
      </form>
    </section>
  );
}
