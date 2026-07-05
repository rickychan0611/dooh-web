import Link from "next/link";
import { monthlySubscriptionAmount } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function OwnerPage() {
  const admin = getSupabaseAdmin();
  const [{ data: organizations }, { data: refunds }, { data: devices }] = await Promise.all([
    admin
      .from("organizations")
      .select("*, screens(count), billing_subscriptions(*)")
      .order("created_at", { ascending: false }),
    admin.from("refund_applications").select("id,status,requested_amount_cents").eq("status", "pending"),
    admin.from("screen_devices").select("id,screens!inner(organization_id)").is("revoked_at", null),
  ]);
  const orgs = organizations ?? [];
  const statusCount = (status: string) => orgs.filter((org: any) => org.status === status).length;
  const estimatedMrr = orgs
    .filter((org: any) => org.status === "active")
    .reduce((total: number, org: any) => total + monthlySubscriptionAmount(org.screen_license_quantity ?? 1), 0);
  const licensedScreens = orgs.reduce((total: number, org: any) => total + Number(org.screen_license_quantity ?? 0), 0);
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Platform</p><h1>Organizations</h1></div></header>
      <section className="stat-grid">
        <article className="stat-card"><span>Estimated MRR</span><strong>${estimatedMrr}</strong></article>
        <article className="stat-card"><span>Active paid</span><strong>{statusCount("active")}</strong></article>
        <article className="stat-card"><span>Trials</span><strong>{statusCount("trialing")}</strong></article>
        <article className="stat-card"><span>Pending refunds</span><strong>{refunds?.length ?? 0}</strong></article>
        <article className="stat-card"><span>Licensed screens</span><strong>{licensedScreens}</strong></article>
        <article className="stat-card"><span>Paired players</span><strong>{devices?.length ?? 0}</strong></article>
      </section>
      <section className="stat-grid">
        <article className="stat-card"><span>Grace</span><strong>{statusCount("grace")}</strong></article>
        <article className="stat-card"><span>Suspended</span><strong>{statusCount("suspended")}</strong></article>
        <article className="stat-card"><span>Canceled</span><strong>{statusCount("canceled")}</strong></article>
      </section>
      <section className="panel table-wrap"><table><thead><tr><th>Business</th><th>Status</th><th>Licenses</th><th>Screens</th><th>Currency</th><th>Created</th></tr></thead><tbody>
        {orgs.map((organization: any) => <tr key={organization.id}><td><Link href={`/owner/organizations/${organization.id}`}><strong>{organization.name}</strong></Link></td><td><span className={`badge ${organization.status === "active" ? "success" : organization.status === "grace" ? "warning" : ""}`}>{organization.status}</span></td><td>{organization.screen_license_quantity}</td><td>{organization.screens?.[0]?.count ?? 0}</td><td>{organization.billing_currency.toUpperCase()}</td><td>{new Date(organization.created_at).toLocaleDateString()}</td></tr>)}
      </tbody></table></section>
    </>
  );
}
