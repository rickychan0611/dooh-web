import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createStaffPost,
  moderateMessage,
  resolvePostReport,
} from "@/app/dashboard/actions";
import { BULLETIN_CATEGORIES } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
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
  const [screens, messageSummary] = await whenDevBypass([[] as ScreenSummary[], [] as any[]], async () => {
    const admin = getSupabaseAdmin();
    const [{ data: screenRows }, { data: summaryRows }] = await Promise.all([
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
    return [screenRows ?? [], summaryRows ?? []];
  });
  const counts = new Map<string, { active: number; pending: number; total: number }>();
  for (const message of messageSummary) {
    const count = counts.get(message.screen_id) ?? { active: 0, pending: 0, total: 0 };
    count.total += 1;
    if (message.status === "active") count.active += 1;
    if (message.status === "pending") count.pending += 1;
    counts.set(message.screen_id, count);
  }

  const selectedScreen = selectedScreenId
    ? screens.find((screen: ScreenSummary) => screen.id === selectedScreenId)
    : null;
  if (selectedScreenId && !selectedScreen) notFound();

  let messagesWithMedia: any[] = [];
  let reportsByPost = new Map<string, any[]>();
  if (selectedScreen) {
    messagesWithMedia = await whenDevBypass([] as any[], async () => {
      const admin = getSupabaseAdmin();
      const { data: messages } = await admin
        .from("bulletin_messages")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("screen_id", selectedScreen.id)
        .not("status", "in", '("deleted")')
        .order("created_at", { ascending: false });
      return Promise.all(
        (messages ?? []).map(async (message: any) => {
          if (!message.media_path) return message;
          const { data } = await admin.storage
            .from("bulletin-media")
            .createSignedUrl(message.media_path, 3600);
          return { ...message, media_preview_url: data?.signedUrl ?? null };
        }),
      );
    });
    const postIds = messagesWithMedia.map((message) => message.id);
    if (postIds.length) {
      const reports = await whenDevBypass([] as any[], async () => {
        const admin = getSupabaseAdmin();
        const { data: reportRows } = await admin
          .from("post_reports")
          .select("id,post_id,reason,status,created_at")
          .eq("organization_id", organizationId)
          .eq("status", "open")
          .in("post_id", postIds)
          .order("created_at", { ascending: false });
        return reportRows ?? [];
      });
      reportsByPost = new Map();
      for (const report of reports) {
        reportsByPost.set(report.post_id, [
          ...(reportsByPost.get(report.post_id) ?? []),
          report,
        ]);
      }
    }
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
          {screens.map((screen: ScreenSummary) => {
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
          <section className="panel compact-create-panel">
            <div className="panel-heading"><div><p className="eyebrow">Staff post</p><h2>Create a board message</h2></div></div>
            <form action={createStaffPost} className="form-grid">
              <input type="hidden" name="screenId" value={selectedScreen.id} />
              <label>Title<input name="title" maxLength={80} required /></label>
              <label>Category<select name="category" defaultValue="announcements">{BULLETIN_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>
              <label className="wide">Message<textarea name="body" maxLength={2000} required /></label>
              <label>Starts<input name="startsAt" type="datetime-local" /></label>
              <label>Ends<input name="endsAt" type="datetime-local" /></label>
              <div className="form-action"><button className="button">Publish post</button></div>
            </form>
          </section>
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
                {(reportsByPost.get(message.id) ?? []).map((report: any) => (
                  <section className="notice danger" key={report.id}>
                    <strong>Reported for review</strong>
                    <p>{report.reason}</p>
                    <div className="actions">
                      <form action={resolvePostReport}><input type="hidden" name="reportId" value={report.id} /><input type="hidden" name="status" value="resolved" /><button className="button compact-button">Resolve</button></form>
                      <form action={resolvePostReport}><input type="hidden" name="reportId" value={report.id} /><input type="hidden" name="status" value="dismissed" /><button className="button secondary compact-button">Dismiss</button></form>
                    </div>
                  </section>
                ))}
                {message.media_preview_url && <a href={message.media_preview_url} target="_blank" rel="noreferrer">Open attached media</a>}
                <div className="actions">
                  {message.status === "active" && <a className="button secondary" href={`/posts/${message.id}`} target="_blank" rel="noreferrer">View public detail</a>}
                  {message.status === "pending" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="active" /><button className="button" type="submit">Approve</button></form>}
                  {message.status === "pending" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="rejected" /><button className="button secondary" type="submit">Reject</button></form>}
                  {message.status === "active" && <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="hidden" /><button className="button danger" type="submit">Remove from screens</button></form>}
                  <form action={moderateMessage}><input type="hidden" name="id" value={message.id} /><input type="hidden" name="status" value="deleted" /><button className="button danger" type="submit">Delete</button></form>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}
