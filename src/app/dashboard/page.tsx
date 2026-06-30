import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { serviceState } from "@/lib/entitlements";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const { organizationId, organization } = await requireAdmin();
  const emptyStats = { count: 0, data: [] as any[] };
  const [screens, online, pending, ads, errors, paired] = await whenDevBypass(
    [emptyStats, emptyStats, emptyStats, emptyStats, emptyStats, emptyStats],
    async () => {
      const admin = getSupabaseAdmin();
      const hourAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      return Promise.all([
        admin.from("screens").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        admin.from("screens").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("last_heartbeat_at", hourAgo),
        admin.from("bulletin_messages").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
        admin.from("ads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
        admin.from("player_errors").select("id, error_type, error_message, created_at, screens!inner(name,organization_id)").eq("screens.organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
        admin.from("screen_devices").select("id,screens!inner(organization_id)", { count: "exact", head: true }).eq("screens.organization_id", organizationId).is("revoked_at", null),
      ]);
    },
  );

  const stats = [
    ["Total screens", screens.count ?? 0],
    ["Online now", online.count ?? 0],
    ["Pending posts", pending.count ?? 0],
    ["Active ads", ads.count ?? 0],
  ];

  return (
    <>
      {welcome && <p className="notice success">Your 14-day trial is ready. Follow the steps below to put your first screen online.</p>}
      {serviceState(organization) === "grace" && <p className="notice danger">Payment needs attention. Your screens remain active during the seven-day grace period. <Link href="/dashboard/billing">Fix payment</Link></p>}
      {serviceState(organization) === "suspended" && <p className="notice danger">Screen service is suspended. <Link href="/dashboard/billing">Reactivate your subscription</Link>.</p>}
      <header className="page-header">
        <div><p className="eyebrow">Operations</p><h1>Dashboard</h1></div>
        <Link className="button" href={screens.count ? "/dashboard/screens" : "/dashboard/screens?create=1"}>
          {screens.count ? "Manage screens" : "Create screen"}
        </Link>
      </header>
      {!screens.count && (
        <section className="panel">
          <p className="eyebrow">Getting started</p>
          <h2>Create your first screen</h2>
          <p className="muted">
            Add a screen name and ID, then pair your player with the six-digit code.
          </p>
          <div className="actions">
            <Link className="button" href="/dashboard/screens?create=1">
              Create screen
            </Link>
          </div>
        </section>
      )}
      <section className="stat-grid">
        {stats.map(([label, value]) => (
          <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>
        ))}
      </section>
      <section className="panel onboarding-panel">
        <div className="panel-heading"><div><p className="eyebrow">Getting started</p><h2>Launch your first screen</h2></div><span className="badge">{[Boolean(screens.count), Boolean(ads.count), Boolean(paired.count), Boolean(online.count)].filter(Boolean).length}/4 complete</span></div>
        <div className="onboarding-steps">
          <Link href="/dashboard/screens"><span>{screens.count ? "✓" : "1"}</span><div><strong>Create a screen</strong><p>Name the TV or browser you want to manage.</p></div></Link>
          <Link href="/dashboard/media"><span>{ads.count ? "✓" : "2"}</span><div><strong>Upload content</strong><p>Add your first image or video promotion.</p></div></Link>
          <Link href="/dashboard/screens"><span>{paired.count ? "✓" : "3"}</span><div><strong>Enter the pairing code</strong><p>Connect one player to the screen license.</p></div></Link>
          <Link href="/dashboard/screens"><span>{online.count ? "✓" : "4"}</span><div><strong>Verify it is online</strong><p>Confirm the player is syncing and reporting health.</p></div></Link>
        </div>
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
