import Link from "next/link";
import { CheckoutEmbed } from "@/components/embedded-checkout";
import { requireManager } from "@/lib/auth";
import { devOrganizationEntitlements, whenDevBypass } from "@/lib/dev-bypass";
import { getOrganizationEntitlements } from "@/lib/entitlements";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  openCustomerPortal,
  updateScreenLicenses,
} from "./actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { organizationId, organization } = await requireManager();
  const [subscriptionResult, access, activeScreensResult] = await whenDevBypass(
    [{ data: null }, devOrganizationEntitlements(organizationId), { count: 0 }],
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
  const monthly = currency === "USD" ? 6 : 9;
  const yearly = currency === "USD" ? 60 : 90;

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
      <section className="stat-grid">
        <article className="stat-card"><span>Service</span><strong className="status-text">{access.serviceState}</strong></article>
        <article className="stat-card"><span>Screen licenses</span><strong>{organization.screen_license_quantity}</strong></article>
        <article className="stat-card"><span>Active screens</span><strong>{activeScreens}</strong></article>
        <article className="stat-card"><span>Storage allowance</span><strong>{Math.round(access.storageLimitBytes / 1073741824)} GB</strong></article>
      </section>
      {needsCheckout ? (
        <>
          <section className="pricing-grid">
            <article className="panel pricing-card"><p className="eyebrow">Flexible</p><h2>{currency} ${monthly}/screen/month</h2><Link className="button secondary" href={`/dashboard/billing?quantity=${quantity}&interval=month`}>Choose monthly</Link></article>
            <article className="panel pricing-card featured"><p className="eyebrow">Two months free</p><h2>{currency} ${yearly}/screen/year</h2><Link className="button" href={`/dashboard/billing?quantity=${quantity}&interval=year`}>Choose annual</Link></article>
          </section>
          <section className="panel billing-quantity">
            <form method="get" className="inline-form">
              <label>Number of screens<input name="quantity" type="number" min="1" max="500" defaultValue={quantity} /></label>
              <input type="hidden" name="interval" value={params.interval ?? "year"} />
              <button className="button secondary">Update total</button>
            </form>
          </section>
          {params.interval && <section className="panel checkout-panel"><CheckoutEmbed interval={params.interval === "month" ? "month" : "year"} quantity={quantity} /></section>}
        </>
      ) : (
        <section className="panel">
          <h2>Screen licenses</h2>
          <p className="muted">Increases are billed immediately. Reductions take effect after the current paid period.</p>
          {subscription?.pending_quantity != null && <p className="notice">Scheduled quantity at renewal: {subscription.pending_quantity}</p>}
          <form action={updateScreenLicenses} className="inline-form">
            <input name="quantity" type="number" min="1" max="500" defaultValue={organization.screen_license_quantity} />
            <button className="button">Update licenses</button>
          </form>
        </section>
      )}
    </>
  );
}
