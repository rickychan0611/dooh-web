import Link from "next/link";
import { formatBulletinCategoryLabel } from "@/lib/shared";
import { notFound } from "next/navigation";
import { PostActions } from "@/components/post-actions";
import { getPublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function NumberedPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenCode: string; postNumber: string }>;
  searchParams: Promise<{ qr?: string }>;
}) {
  const { screenCode, postNumber } = await params;
  const { qr } = await searchParams;
  if (!/^\d+$/.test(postNumber)) notFound();
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: post } = await admin
    .from("bulletin_messages")
    .select("id,post_number,title,body,category,submitter_name,submitter_contact,show_contact_publicly,media_path,media_type,media_mime_type,created_at,screens!inner(name,screen_code,is_active)")
    .eq("post_number", Number(postNumber))
    .eq("status", "active")
    .eq("screens.screen_code", screenCode.toUpperCase())
    .eq("screens.is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .maybeSingle();
  if (!post) notFound();

  const user = await getPublicUser();
  const [{ data: signedMedia }, { data: saved }] = await Promise.all([
    post.media_path
      ? admin.storage.from("bulletin-media").createSignedUrl(post.media_path, 3600)
      : Promise.resolve({ data: null }),
    user
      ? admin.from("saved_posts").select("post_id").eq("user_id", user.id).eq("post_id", post.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const qrQuery = qr ? `?qr=${encodeURIComponent(qr)}` : "";
  const directoryUrl = `/screens/${post.screens.screen_code}/posts${qrQuery}`;
  const currentUrl = `/screens/${post.screens.screen_code}/posts/${post.post_number}${qrQuery}`;

  return (
    <main className="post-detail-shell">
      <article className="post-detail-card">
        <Link href={directoryUrl} className="post-back-link">Back to all posts</Link>
        <div className="post-detail-number">#{post.post_number}</div>
        <p className="eyebrow">{formatBulletinCategoryLabel(post.category)} &middot; {post.screens.name}</p>
        <h1>{post.title}</h1>
        <p className="post-date">Posted {new Date(post.created_at).toLocaleString()}</p>
        <PostActions postId={post.id} initiallySaved={Boolean(saved)} signedIn={Boolean(user)} loginUrl={`/account/login?next=${encodeURIComponent(currentUrl)}`} />
        {signedMedia?.signedUrl && (post.media_type === "video" ? (
          <video className="post-media" controls playsInline preload="metadata">
            <source src={signedMedia.signedUrl} type={post.media_mime_type ?? undefined} />
          </video>
        ) : (
          <img className="post-media" src={signedMedia.signedUrl} alt="" />
        ))}
        <div className="post-body">{post.body}</div>
        {post.submitter_name && <section className="post-contact">
          <p className="eyebrow">Posted by</p>
          <h2>{post.submitter_name}</h2>
          {post.show_contact_publicly && post.submitter_contact && <p className="post-contact-value">{post.submitter_contact}</p>}
        </section>}
      </article>
    </main>
  );
}
