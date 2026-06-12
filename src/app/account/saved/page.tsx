import Link from "next/link";
import { requirePublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function SavedPostsPage() {
  const user = await requirePublicUser("/account/saved");
  const { data: saves } = await getSupabaseAdmin()
    .from("saved_posts")
    .select("created_at,bulletin_messages!inner(id,post_number,title,body,status,starts_at,ends_at,screens!inner(screen_code,name,is_active))")
    .eq("user_id", user.id)
    .eq("bulletin_messages.status", "active")
    .eq("bulletin_messages.screens.is_active", true)
    .order("created_at", { ascending: false });
  const now = Date.now();
  const activeSaves = (saves ?? []).filter((save: any) => {
    const post = save.bulletin_messages;
    return (
      (!post.starts_at || new Date(post.starts_at).getTime() <= now) &&
      (!post.ends_at || new Date(post.ends_at).getTime() > now)
    );
  });
  return (
    <section>
      <p className="eyebrow">Your account</p><h1>Saved posts</h1>
      <div className="posts-list">
        {activeSaves.map((save: any) => {
          const post = save.bulletin_messages;
          return <Link className="panel public-post-card" href={`/screens/${post.screens.screen_code}/posts/${post.post_number}`} key={post.id}>
            <span className="post-number">#{post.post_number}</span><div><p className="eyebrow">{post.screens.name}</p><h2>{post.title}</h2><p>{post.body}</p></div>
          </Link>;
        })}
        {!activeSaves.length && <p className="notice">No saved posts yet.</p>}
      </div>
    </section>
  );
}
