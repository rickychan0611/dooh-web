import Link from "next/link";
import { formatBulletinCategoryLabel } from "@dooh/shared";
import { notFound, redirect } from "next/navigation";
import { PublicAccountNav } from "@/components/public-account-nav";
import { parsePostNumberSearch } from "@/lib/posts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

export default async function ScreenPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenCode: string }>;
  searchParams: Promise<{ q?: string; page?: string; qr?: string }>;
}) {
  const { screenCode } = await params;
  const query = await searchParams;
  const admin = getSupabaseAdmin();
  const { data: screen } = await admin
    .from("screens")
    .select("id,screen_code,name,location")
    .eq("screen_code", screenCode.toUpperCase())
    .eq("is_active", true)
    .eq("public_directory_enabled", true)
    .maybeSingle();
  if (!screen) notFound();

  const searchedNumber = parsePostNumberSearch(query.q);
  if (searchedNumber) {
    redirect(
      `/screens/${screen.screen_code}/posts/${searchedNumber}${query.qr ? `?qr=${encodeURIComponent(query.qr)}` : ""}`,
    );
  }

  const page = Math.max(1, Number(query.page) || 1);
  const now = new Date().toISOString();
  const { data: posts, count } = await admin
    .from("bulletin_messages")
    .select("id,post_number,title,body,category,created_at", { count: "exact" })
    .eq("screen_id", screen.id)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const qrSuffix = query.qr ? `?qr=${encodeURIComponent(query.qr)}` : "";

  return (
    <main className="public-shell posts-shell">
      <header className="public-header">
        <Link href="/screens" className="brand">DOOH<span>Community Boards</span></Link>
        <PublicAccountNav />
      </header>
      <section className="posts-heading">
        <p className="eyebrow">{screen.location || screen.screen_code}</p>
        <h1>{screen.name}</h1>
        <form className="post-number-search">
          {query.qr && <input type="hidden" name="qr" value={query.qr} />}
          <input name="q" inputMode="numeric" placeholder="Enter post number, e.g. #12" aria-label="Post number" />
          <button className="button" type="submit">Find post</button>
        </form>
      </section>
      <section className="posts-list">
        {(posts ?? []).map((post: any) => (
          <Link className="panel public-post-card" href={`/screens/${screen.screen_code}/posts/${post.post_number}${qrSuffix}`} key={post.id}>
            <span className="post-number">#{post.post_number}</span>
            <div><p className="eyebrow">{formatBulletinCategoryLabel(post.category)}</p><h2>{post.title}</h2><p>{post.body}</p></div>
          </Link>
        ))}
        {!posts?.length && <p className="notice">No active posts yet.</p>}
      </section>
      {pageCount > 1 && <nav className="pagination">
        {page > 1 && <Link className="button secondary" href={`?page=${page - 1}${query.qr ? `&qr=${encodeURIComponent(query.qr)}` : ""}`}>Previous</Link>}
        <span>Page {page} of {pageCount}</span>
        {page < pageCount && <Link className="button secondary" href={`?page=${page + 1}${query.qr ? `&qr=${encodeURIComponent(query.qr)}` : ""}`}>Next</Link>}
      </nav>}
      <Link className="button sticky-create-button" href={`/submit/${screen.screen_code}${qrSuffix}`}>Create new post</Link>
    </main>
  );
}
