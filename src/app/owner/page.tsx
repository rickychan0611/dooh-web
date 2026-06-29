import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function OwnerPage() {
  const admin = getSupabaseAdmin();
  const { data: organizations } = await admin
    .from("organizations")
    .select("*, screens(count), billing_subscriptions(*)")
    .order("created_at", { ascending: false });
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Platform</p><h1>Organizations</h1></div></header>
      <section className="panel table-wrap"><table><thead><tr><th>Business</th><th>Status</th><th>Licenses</th><th>Screens</th><th>Currency</th><th>Created</th></tr></thead><tbody>
        {(organizations ?? []).map((organization: any) => <tr key={organization.id}><td><Link href={`/owner/organizations/${organization.id}`}><strong>{organization.name}</strong></Link></td><td><span className={`badge ${organization.status === "active" ? "success" : organization.status === "grace" ? "warning" : ""}`}>{organization.status}</span></td><td>{organization.screen_license_quantity}</td><td>{organization.screens?.[0]?.count ?? 0}</td><td>{organization.billing_currency.toUpperCase()}</td><td>{new Date(organization.created_at).toLocaleDateString()}</td></tr>)}
      </tbody></table></section>
    </>
  );
}
