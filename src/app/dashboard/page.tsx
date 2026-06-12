import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function DashboardPage() {
  const { organizationId } = await requireAdmin();
  const admin = getSupabaseAdmin();
  const hourAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const [screens, online, pending, ads, errors] = await Promise.all([
    admin.from("screens").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("screens").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("last_heartbeat_at", hourAgo),
    admin.from("bulletin_messages").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    admin.from("ads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    admin.from("player_errors").select("id, error_type, error_message, created_at, screens(name)").order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = [
    ["Total screens", screens.count ?? 0],
    ["Online now", online.count ?? 0],
    ["Pending posts", pending.count ?? 0],
    ["Active ads", ads.count ?? 0],
  ];

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">Operations</p><h1>Dashboard</h1></div>
        <Link className="button" href="/dashboard/screens">Manage screens</Link>
      </header>
      <section className="stat-grid">
        {stats.map(([label, value]) => (
          <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>
        ))}
      </section>
      <section className="panel">
        <h2>Recent player errors</h2>
        {!errors.data?.length ? <p className="muted">No player errors reported.</p> : (
          <div className="list">
            {errors.data.map((error: any) => (
              <div className="list-row" key={error.id}>
                <div><strong>{error.error_type}</strong><p>{error.error_message}</p></div>
                <time>{new Date(error.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
