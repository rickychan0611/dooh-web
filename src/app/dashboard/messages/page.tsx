import Link from "next/link";
import { notFound } from "next/navigation";
import { moderateMessage } from "@/app/dashboard/actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ScreenSummary = {
  id: string;
  location: string | null;
  name: string;
  screen_code: string;
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const { screen: selectedScreenId } = await searchParams;
  const { organizationId } = await requireAdmin();
  const admin = getSupabaseAdmin();
  const [{ data: screens }, { data: messageSummary }] = await Promise.all([
    admin
      .from("screens")
      .select("id,location,name,screen_code")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("bulletin_messages")
      .select("screen_id,status")
      .eq("organization_id", organizationId)
      .not("status", "in", '("deleted")'),
  ]);
  const counts = new Map<string, { active: number; pending: number; total: number }>();
  for (const message of messageSummary ?? []) {
    const count = counts.get(message.screen_id) ?? { active: 0, pending: 0, total: 0 };
    count.total += 1;
    if (message.status === "active") count.active += 1;
    if (message.status === "pending") count.pending += 1;
    counts.set(message.screen_id, count);
  }

  const selectedScreen = selectedScreenId
    ? (screens ?? []).find((screen: ScreenSummary) => screen.id === selectedScreenId)
    : null;
  if (selectedScreenId && !selectedScreen) notFound();

  let messagesWithMedia: any[] = [];
  if (selectedScreen) {
    const { data: messages } = await admin
      .from("bulletin_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("screen_id", selectedScreen.id)
      .not("status", "in", '("deleted")')
      .order("created_at", { ascending: false });
    messagesWithMedia = await Promise.all(
      (messages ?? []).map(async (message: any) => {
        if (!message.media_path) return message;
        const { data } = await admin.storage
          .from("bulletin-media")
          .createSignedUrl(message.media_path, 3600);
        return { ...message, media_preview_url: data?.signedUrl ?? null };
      }),
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1>{selectedScreen ? selectedScreen.name : "Choose a screen"}</h1>
          {selectedScreen && (
            <p className="muted">
              {selectedScreen.location || selectedScreen.screen_code}
            </p>
          )}
        </div>
        {selectedScreen && <Link className="button secondary" href="/dashboard/messages">Change screen</Link>}
      </header>

      {!selectedScreen ? (
        <div className="screen-picker-grid">
          {((screens ?? []) as ScreenSummary[]).map((screen) => {
            const count = counts.get(screen.id) ?? { active: 0, pending: 0, total: 0 };
            return (
              <Link className="panel screen-picker-card" href={`/dashboard/messages?screen=${screen.id}`} key={screen.id}>
                <div><h2>{screen.name}</h2><p>{screen.location || screen.screen_code}</p></div>
                <div className="screen-message-counts">
                  {count.pending > 0 && <span className="badge warning">{count.pending} pending</span>}
                  <span className="badge success">{count.active} active</span>
                  <span className="badge">{count.total} total</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <>
          {!messagesWithMedia.length && (
            <section className="panel empty-state">
              <h2>No messages for this screen</h2>
              <p className="muted">New submissions for this screen will appear here.</p>
            </section>
          )}
          <section className="list">
            {messagesWithMedia.map((message: any) => (
              <article className="panel message-card" key={message.id}>
                <div className="message-meta">
                  <span className={`badge ${message.status === "active" ? "success" : message.status === "pending" ? "warning" : ""}`}>{message.status}</span>
                  <span>{message.source} · Post #{message.post_number}</span>
                  <time>{new Date(message.created_at).toLocaleString()}</time>
                </div>
                <h2>{message.title}</h2><p>{message.body}</p>
                {message.media_preview_url && <a href={message.media_preview_url} target="_blank" rel="noreferrer">Open attached media</a>}
                <div className="actions">
                  {message.status === "active" && <a className="button secondary" href={`/posts/${message.id}`} target="_blank" rel="noreferrer">View public detail</a>}
                  {message.status === "pending" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="active" /><button className="button" type="submit">Approve</button></form>}
                  {message.status === "pending" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="rejected" /><button className="button secondary" type="submit">Reject</button></form>}
                  {message.status === "active" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="hidden" /><button className="button danger" type="submit">Remove from screens</button></form>}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}
