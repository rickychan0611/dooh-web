import Link from "next/link";
import { CheckoutEmbed } from "@/components/embedded-checkout";
import { requireManager } from "@/lib/auth";
import { devOrganizationEntitlements, whenDevBypass } from "@/lib/dev-bypass";
import { getOrganizationEntitlements } from "@/lib/entitlements";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  openCustomerPortal,
  submitRefundApplication,
  updateScreenLicenses,
} from "./actions";
import { INCLUDED_SCREENS, monthlySubscriptionAmount } from "@/lib/stripe";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { organizationId, organization } = await requireManager();
  const [subscriptionResult, access, activeScreensResult, changeResult, refundResult] = await whenDevBypass(
    [{ data: null }, devOrganizationEntitlements(organizationId), { count: 0 }, { data: [] }, { data: [] }],
    async () => {
      const admin = getSupabaseAdmin();
      return Promise.all([
        admin
          .from("billing_subscriptions")
          .select("*")
          .eq("organization_id", organizationId)
          .single(),
        getOrganizationEntitlements(organizationId),
        admin
          .from("screens")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("is_active", true),
        admin
          .from("license_change_events")
          .select("*, refund_applications(*)")
          .eq("organization_id", organizationId)
          .gt("delta", 0)
          .gt("amount_cents", 0)
          .order("created_at", { ascending: false }),
        admin
          .from("refund_applications")
          .select("*, license_change_events(*)")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ]);
    },
  );
  const subscription = subscriptionResult.data;
  const activeScreens = activeScreensResult.count ?? 0;
  const quantity = Math.max(
    1,
    Number(params.quantity ?? organization.screen_license_quantity ?? 1),
  );
  const needsCheckout = !subscription?.stripe_subscription_id;
  const currency = organization.billing_currency === "usd" ? "USD" : "CAD";
  const estimate = monthlySubscriptionAmount(quantity);
  const changes = changeResult.data ?? [];
  const refunds = refundResult.data ?? [];

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">Subscription</p><h1>Billing</h1></div>
        {organization.stripe_customer_id && (
          <form action={openCustomerPortal}><button className="button secondary">Invoices and payment method</button></form>
        )}
      </header>
      {params.error === "deactivate-screens" && <p className="notice danger">Deactivate screens before reducing licenses below {activeScreens}.</p>}
      {params.updated && <p className="notice success">Your license change was saved.</p>}
      {params.refund === "submitted" && <p className="notice success">Your refund request was submitted for review.</p>}
      {params.refund === "expired" && <p className="notice danger">That license change is outside the seven-day refund window.</p>}
      {params.refund === "duplicate" && <p className="notice danger">A refund request already exists for that license change.</p>}
      {params.refund === "missing-reason" && <p className="notice danger">Please include a reason for the refund request.</p>}
      <section className="stat-grid">
        <article className="stat-card"><span>Service</span><strong className="status-text">{access.serviceState}</strong></article>
        <article className="stat-card"><span>Screen licenses</span><strong>{organization.screen_license_quantity}</strong></article>
        <article className="stat-card"><span>Active screens</span><strong>{activeScreens}</strong></article>
        <article className="stat-card"><span>Monthly price</span><strong>{currency} ${monthlySubscriptionAmount(organization.screen_license_quantity)}</strong></article>
      </section>
      {needsCheckout ? (
        <>
          <section className="pricing-grid">
            <article className="panel pricing-card featured"><p className="eyebrow">Simple monthly plan</p><h2>{currency} ${estimate}/month</h2><p>Includes up to {INCLUDED_SCREENS} screens for {currency} $9/month. Extra screens are {currency} $3/month each.</p><Link className="button" href={`/dashboard/billing?quantity=${quantity}&checkout=1`}>Start subscription</Link></article>
          </section>
          <section className="panel billing-quantity">
            <form method="get" className="inline-form">
              <label>Number of screens<input name="quantity" type="number" min="1" max="500" defaultValue={quantity} /></label>
              <button className="button secondary">Update total</button>
            </form>
          </section>
          {params.checkout && <section className="panel checkout-panel"><CheckoutEmbed quantity={quantity} /></section>}
        </>
      ) : (
        <section className="panel">
          <h2>Screen licenses</h2>
          <p className="muted">The first {INCLUDED_SCREENS} screens are included for {currency} $9/month. Extra screens are {currency} $3/month each. Increases are billed immediately.</p>
          {subscription?.pending_quantity != null && <p className="notice">Scheduled quantity at renewal: {subscription.pending_quantity}</p>}
          <form action={updateScreenLicenses} className="inline-form">
            <input name="quantity" type="number" min="1" max="500" defaultValue={organization.screen_license_quantity} />
            <button className="button">Update licenses</button>
          </form>
        </section>
      )}
      <section className="panel table-wrap">
        <h2>Refund requests</h2>
        {!changes.length && !refunds.length ? <p className="muted">No refundable license additions yet.</p> : (
          <table>
            <thead><tr><th>Change</th><th>Refund window</th><th>Amount</th><th>Status</th><th>Apply</th></tr></thead>
            <tbody>
              {changes.map((change: any) => {
                const existing = change.refund_applications?.[0] ?? refunds.find((refund: any) => refund.license_change_id === change.id);
                const expired = !change.refundable_until || new Date(change.refundable_until).getTime() < Date.now();
                return (
                  <tr key={change.id}>
                    <td>{change.previous_quantity} to {change.new_quantity} licenses</td>
                    <td>{change.refundable_until ? new Date(change.refundable_until).toLocaleDateString() : "Not eligible"}</td>
                    <td>{money(change.amount_cents, change.currency)}</td>
                    <td><span className={`badge ${existing?.status === "refunded" ? "success" : existing?.status === "pending" ? "warning" : ""}`}>{existing?.status ?? (expired ? "expired" : "eligible")}</span></td>
                    <td>
                      {!existing && !expired ? (
                        <form action={submitRefundApplication} className="stack">
                          <input type="hidden" name="licenseChangeId" value={change.id} />
                          <textarea name="reason" placeholder="Why are you requesting this refund?" required />
                          <button className="button secondary compact-button">Apply for refund</button>
                        </form>
                      ) : <span className="muted">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
