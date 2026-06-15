import { updatePassword } from "@/app/account/actions";
import { requirePublicUser } from "@/lib/public-auth";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePublicUser("/account/reset-password");
  const { error } = await searchParams;

  return (
    <section className="panel auth-panel account-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      {error === "update-failed" && (
        <p className="notice danger">
          The password could not be updated. Please try again.
        </p>
      )}
      <form action={updatePassword} className="stack">
        <label>
          New password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button className="button" type="submit">
          Update password
        </button>
      </form>
    </section>
  );
}
