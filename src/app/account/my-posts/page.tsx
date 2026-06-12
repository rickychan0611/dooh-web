import Link from "next/link";
import { DeletePostButton } from "@/components/delete-post-button";
import { requirePublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function MyPostsPage() {
  const user = await requirePublicUser("/account/my-posts");
  const { data: posts } = await getSupabaseAdmin()
    .from("bulletin_messages")
    .select("id,post_number,title,body,status,created_at,screens(screen_code,name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (
    <section>
      <p className="eyebrow">Your account</p><h1>My posts</h1>
      <div className="posts-list">
        {(posts ?? []).map((post: any) => <article className="panel public-post-card" key={post.id}>
          <span className="post-number">#{post.post_number}</span>
          <div><span className={`badge ${post.status === "active" ? "success" : ""}`}>{post.status}</span><h2>{post.title}</h2><p>{post.body}</p><div className="actions">
            {post.status === "active" && <Link className="button secondary" href={`/screens/${post.screens.screen_code}/posts/${post.post_number}`}>Open</Link>}
            {post.status !== "deleted" && <DeletePostButton postId={post.id} />}
          </div></div>
        </article>)}
        {!posts?.length && <p className="notice">You have not created any posts.</p>}
      </div>
    </section>
  );
}
