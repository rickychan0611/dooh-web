import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  addSupportNote,
  cancelOrganizationSubscriptionNow,
  issueRefundApplication,
  rejectRefundApplication,
  resumeOrganizationSubscription,
  setFeatureFlag,
  setOrganizationStatus,
} from "./actions";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const [{ data: organization }, { data: screens }, { data: assets }, { data: notes }, { data: flags }, { data: audits }, { data: members }, { data: changes }, { data: refunds }, { data: billingEvents }, { data: views }] = await Promise.all([
    admin.from("organizations").select("*,billing_subscriptions(*),organization_entitlements(*)").eq("id", id).single(),
    admin.from("screens").select("id,name,last_heartbeat_at,is_active").eq("organization_id", id).order("name"),
    admin.from("ads").select("file_size").eq("organization_id", id).neq("status", "deleted"),
    admin.from("organization_support_notes").select("*").eq("organization_id", id).order("created_at", { ascending: false }),
    admin.from("organization_feature_flags").select("*").eq("organization_id", id).order("flag"),
    admin.from("audit_logs").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("admin_users").select("*").eq("organization_id", id).order("created_at"),
    admin.from("license_change_events").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("refund_applications").select("*,license_change_events(*)").eq("organization_id", id).order("created_at", { ascending: false }),
    admin.from("billing_events").select("stripe_event_id,event_type,processed_at").eq("organization_id", id).order("processed_at", { ascending: false }).limit(20),
    admin.from("ad_playback_view_counts").select("total_views,views_7d,views_30d").eq("organization_id", id),
  ]);
  if (!organization) notFound();
  const storage = (assets ?? []).reduce((total: number, asset: any) => total + Number(asset.file_size ?? 0), 0);
  const online = (screens ?? []).filter((screen: any) => screen.last_heartbeat_at && Date.now() - new Date(screen.last_heartbeat_at).getTime() < 300000).length;
  const viewTotals = (views ?? []).reduce((total: any, row: any) => ({
    total: total.total + Number(row.total_views ?? 0),
    seven: total.seven + Number(row.views_7d ?? 0),
    thirty: total.thirty + Number(row.views_30d ?? 0),
  }), { total: 0, seven: 0, thirty: 0 });
  return (
    <>
      <header className="page-header owner-detail-header"><div><Link href="/owner" className="owner-back-link"><ArrowLeft aria-hidden="true" />Organizations</Link><div className="owner-detail-title"><h1>{organization.name}</h1><span className={`badge ${organization.status === "active" ? "success" : organization.status === "grace" ? "warning" : ""}`}>{organization.status}</span></div><p className="muted">{organization.country_code} · {organization.billing_currency.toUpperCase()} · {organization.timezone}</p></div></header>
      <section className="stat-grid"><article className="stat-card"><span>Licenses</span><strong>{organization.screen_license_quantity}</strong></article><article className="stat-card"><span>Screens online</span><strong>{online}/{screens?.length ?? 0}</strong></article><article className="stat-card"><span>Storage</span><strong>{Math.round(storage / 1048576)} MB</strong></article><article className="stat-card"><span>Trial ends</span><strong className="status-text">{new Date(organization.trial_ends_at).toLocaleDateString()}</strong></article></section>
      <section className="stat-grid"><article className="stat-card"><span>Ad views</span><strong>{viewTotals.total}</strong></article><article className="stat-card"><span>7-day views</span><strong>{viewTotals.seven}</strong></article><article className="stat-card"><span>30-day views</span><strong>{viewTotals.thirty}</strong></article><article className="stat-card"><span>Pending refunds</span><strong>{(refunds ?? []).filter((refund: any) => refund.status === "pending").length}</strong></article></section>
      <div className="two-column">
        <section className="panel"><h2>Account status</h2><form action={setOrganizationStatus} className="inline-form"><input type="hidden" name="organizationId" value={id} /><select name="status" defaultValue={organization.status}><option value="trialing">Trialing</option><option value="active">Active</option><option value="grace">Grace</option><option value="suspended">Suspended</option><option value="canceled">Canceled</option></select><button className="button">Save</button></form></section>
        <section className="panel"><h2>Feature flag</h2><form action={setFeatureFlag} className="stack"><input type="hidden" name="organizationId" value={id} /><input name="flag" placeholder="feature_name" required /><label className="checkbox"><input name="enabled" type="checkbox" /> Enabled</label><button className="button secondary">Set flag</button></form>{(flags ?? []).map((flag: any) => <p key={flag.flag}><code>{flag.flag}</code> {flag.enabled ? "on" : "off"}</p>)}</section>
      </div>
      <section className="panel table-wrap"><h2>Subscription</h2><table><tbody><tr><th>Stripe customer</th><td>{organization.stripe_customer_id ?? "None"}</td></tr><tr><th>Stripe subscription</th><td>{organization.billing_subscriptions?.stripe_subscription_id ?? "None"}</td></tr><tr><th>Stripe status</th><td>{organization.billing_subscriptions?.status ?? "None"}{organization.billing_subscriptions?.cancel_at_period_end ? " · cancels at period end" : ""}</td></tr><tr><th>Current period</th><td>{organization.billing_subscriptions?.current_period_start ? new Date(organization.billing_subscriptions.current_period_start).toLocaleDateString() : "?"} - {organization.billing_subscriptions?.current_period_end ? new Date(organization.billing_subscriptions.current_period_end).toLocaleDateString() : "?"}</td></tr><tr><th>Grace ends</th><td>{organization.grace_ends_at ? new Date(organization.grace_ends_at).toLocaleString() : "None"}</td></tr><tr><th>Suspended</th><td>{organization.suspended_at ? new Date(organization.suspended_at).toLocaleString() : "No"}</td></tr></tbody></table>{organization.billing_subscriptions?.stripe_subscription_id ? <div className="actions"><form action={resumeOrganizationSubscription}><input type="hidden" name="organizationId" value={id} /><button className="button secondary">Resume subscription</button></form><form action={cancelOrganizationSubscriptionNow}><input type="hidden" name="organizationId" value={id} /><button className="button danger">Cancel now and disconnect</button></form></div> : null}</section>
      <section className="panel table-wrap"><h2>Team</h2><table><thead><tr><th>User ID</th><th>Role</th><th>Created</th></tr></thead><tbody>{(members ?? []).map((member: any) => <tr key={member.user_id}><td><code>{member.user_id}</code></td><td>{member.role}</td><td>{new Date(member.created_at).toLocaleString()}</td></tr>)}</tbody></table></section>
      <section className="panel table-wrap"><h2>Refund applications</h2><p className="muted">Issuing a refund also removes the paid licenses. Extra screens are deactivated and those players disconnect.</p>{!(refunds ?? []).length ? <p className="muted">No refund applications.</p> : <table><thead><tr><th>Status</th><th>Amount</th><th>Reason</th><th>Review</th></tr></thead><tbody>{(refunds ?? []).map((refund: any) => <tr key={refund.id}><td><span className={`badge ${refund.status === "refunded" ? "success" : refund.status === "pending" ? "warning" : ""}`}>{refund.status}</span></td><td>{money(refund.requested_amount_cents, refund.currency)}</td><td>{refund.reason}<br /><span className="muted">{refund.failure_message}</span></td><td>{["pending", "approved", "failed"].includes(refund.status) ? <div className="stack"><form action={issueRefundApplication} className="stack"><input type="hidden" name="organizationId" value={id} /><input type="hidden" name="refundId" value={refund.id} /><textarea name="reviewNote" placeholder="Optional note" /><button className="button">Issue refund and reduce licenses</button></form><form action={rejectRefundApplication} className="stack"><input type="hidden" name="organizationId" value={id} /><input type="hidden" name="refundId" value={refund.id} /><textarea name="reviewNote" placeholder="Reason for rejection" /><button className="button secondary">Reject</button></form></div> : refund.review_note}</td></tr>)}</tbody></table>}</section>
      <section className="panel table-wrap"><h2>License changes</h2><table><thead><tr><th>When</th><th>Change</th><th>Refundable until</th><th>Amount</th></tr></thead><tbody>{(changes ?? []).map((change: any) => <tr key={change.id}><td>{new Date(change.created_at).toLocaleString()}</td><td>{change.previous_quantity} to {change.new_quantity}</td><td>{change.refundable_until ? new Date(change.refundable_until).toLocaleDateString() : "No"}</td><td>{money(change.amount_cents, change.currency)}</td></tr>)}</tbody></table></section>
      <section className="panel table-wrap"><h2>Recent Stripe events</h2><table><thead><tr><th>Event</th><th>ID</th><th>Processed</th></tr></thead><tbody>{(billingEvents ?? []).map((event: any) => <tr key={event.stripe_event_id}><td>{event.event_type}</td><td><code>{event.stripe_event_id}</code></td><td>{new Date(event.processed_at).toLocaleString()}</td></tr>)}</tbody></table></section>
      <section className="panel"><h2>Support notes</h2><form action={addSupportNote} className="stack"><input type="hidden" name="organizationId" value={id} /><textarea name="body" required /><button className="button">Add note</button></form><div className="list">{(notes ?? []).map((note: any) => <div className="list-row" key={note.id}><p>{note.body}</p><time>{new Date(note.created_at).toLocaleString()}</time></div>)}</div></section>
      <section className="panel table-wrap"><h2>Recent audit activity</h2><table><thead><tr><th>Action</th><th>Target</th><th>When</th></tr></thead><tbody>{(audits ?? []).map((audit: any) => <tr key={audit.id}><td>{audit.action}</td><td>{audit.target_type} {audit.target_id}</td><td>{new Date(audit.created_at).toLocaleString()}</td></tr>)}</tbody></table></section>
    </>
  );
}
