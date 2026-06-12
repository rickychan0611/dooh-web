import Link from "next/link";
import { publicSignOut } from "@/app/account/actions";
import { getPublicUser } from "@/lib/public-auth";

export async function PublicAccountNav() {
  const user = await getPublicUser();
  return (
    <nav className="public-account-nav">
      <Link href="/screens">Screens</Link>
      {user ? (
        <>
          <Link href="/account/my-posts">My posts</Link>
          <Link href="/account/saved">Saved</Link>
          <Link href="/account/profile">Profile</Link>
          <form action={publicSignOut}>
            <button type="submit" className="link-button">Sign out</button>
          </form>
        </>
      ) : (
        <Link href="/account/login">Sign in</Link>
      )}
    </nav>
  );
}
