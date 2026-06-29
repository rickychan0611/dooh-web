import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addSupportNote, setFeatureFlag, setOrganizationStatus } from "./actions";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const [{ data: organization }, { data: screens }, { data: assets }, { data: notes }, { data: flags }, { data: audits }] = await Promise.all([
    admin.from("organizations").select("*,billing_subscriptions(*),organization_entitlements(*)").eq("id", id).single(),
    admin.from("screens").select("id,name,last_heartbeat_at,is_active").eq("organization_id", id).order("name"),
    admin.from("ads").select("file_size").eq("organization_id", id).neq("status", "deleted"),
    admin.from("organization_support_notes").select("*").eq("organization_id", id).order("created_at", { ascending: false }),
    admin.from("organization_feature_flags").select("*").eq("organization_id", id).order("flag"),
    admin.from("audit_logs").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!organization) notFound();
  const storage = (assets ?? []).reduce((total: number, asset: any) => total + Number(asset.file_size ?? 0), 0);
  const online = (screens ?? []).filter((screen: any) => screen.last_heartbeat_at && Date.now() - new Date(screen.last_heartbeat_at).getTime() < 300000).length;
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">{organization.status}</p><h1>{organization.name}</h1><p className="muted">{organization.country_code} · {organization.billing_currency.toUpperCase()} · {organization.timezone}</p></div></header>
      <section className="stat-grid"><article className="stat-card"><span>Licenses</span><strong>{organization.screen_license_quantity}</strong></article><article className="stat-card"><span>Screens online</span><strong>{online}/{screens?.length ?? 0}</strong></article><article className="stat-card"><span>Storage</span><strong>{Math.round(storage / 1048576)} MB</strong></article><article className="stat-card"><span>Trial ends</span><strong className="status-text">{new Date(organization.trial_ends_at).toLocaleDateString()}</strong></article></section>
      <div className="two-column">
        <section className="panel"><h2>Account status</h2><form action={setOrganizationStatus} className="inline-form"><input type="hidden" name="organizationId" value={id} /><select name="status" defaultValue={organization.status}><option value="trialing">Trialing</option><option value="active">Active</option><option value="grace">Grace</option><option value="suspended">Suspended</option><option value="canceled">Canceled</option></select><button className="button">Save</button></form></section>
        <section className="panel"><h2>Feature flag</h2><form action={setFeatureFlag} className="stack"><input type="hidden" name="organizationId" value={id} /><input name="flag" placeholder="feature_name" required /><label className="checkbox"><input name="enabled" type="checkbox" /> Enabled</label><button className="button secondary">Set flag</button></form>{(flags ?? []).map((flag: any) => <p key={flag.flag}><code>{flag.flag}</code> {flag.enabled ? "on" : "off"}</p>)}</section>
      </div>
      <section className="panel"><h2>Support notes</h2><form action={addSupportNote} className="stack"><input type="hidden" name="organizationId" value={id} /><textarea name="body" required /><button className="button">Add note</button></form><div className="list">{(notes ?? []).map((note: any) => <div className="list-row" key={note.id}><p>{note.body}</p><time>{new Date(note.created_at).toLocaleString()}</time></div>)}</div></section>
      <section className="panel table-wrap"><h2>Recent audit activity</h2><table><thead><tr><th>Action</th><th>Target</th><th>When</th></tr></thead><tbody>{(audits ?? []).map((audit: any) => <tr key={audit.id}><td>{audit.action}</td><td>{audit.target_type} {audit.target_id}</td><td>{new Date(audit.created_at).toLocaleString()}</td></tr>)}</tbody></table></section>
    </>
  );
}
