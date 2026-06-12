import { updateProfile } from "@/app/account/actions";
import { requirePublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; password?: string }>;
}) {
  const user = await requirePublicUser("/account/profile");
  const params = await searchParams;
  const { data: profile } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("display_name,contact")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <section className="panel account-panel">
      <p className="eyebrow">Your account</p>
      <h1>Profile</h1>
      {(params.saved || params.password) && <p className="notice success">Profile updated.</p>}
      <form action={updateProfile} className="stack">
        <label>Email<input value={user.email ?? ""} readOnly /></label>
        <label>Display name<input name="displayName" maxLength={80} defaultValue={profile?.display_name ?? ""} /></label>
        <label>Default contact<input name="contact" maxLength={160} defaultValue={profile?.contact ?? ""} /></label>
        <button className="button" type="submit">Save profile</button>
      </form>
    </section>
  );
}
