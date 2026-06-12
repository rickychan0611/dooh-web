import Link from "next/link";
import { PublicAccountNav } from "@/components/public-account-nav";
import { isConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PublicScreensPage() {
  const configured = isConfigured();
  const screens = configured
    ? (await getSupabaseAdmin().from("screens").select("screen_code,name,location").eq("is_active", true).eq("public_directory_enabled", true).order("name")).data ?? []
    : [];
  return (
    <main className="public-shell">
      <header className="public-header"><Link href="/" className="brand">DOOH<span>Community Boards</span></Link><PublicAccountNav /></header>
      <section className="public-intro"><p className="eyebrow">Public directory</p><h1>Choose a community screen</h1><p>Browse active community posts or sign in to create your own.</p></section>
      {!configured && <p className="notice">Connect Supabase to load the public screen directory.</p>}
      <section className="card-grid">{screens.map((screen: any) => (
        <Link className="panel screen-card" href={`/screens/${screen.screen_code}/posts`} key={screen.screen_code}><span className="badge">Community posts</span><h2>{screen.name}</h2><p>{screen.location || "Community screen"}</p><span>View posts →</span></Link>
      ))}</section>
    </main>
  );
}
