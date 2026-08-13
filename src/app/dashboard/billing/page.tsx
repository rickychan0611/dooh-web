import Link from "next/link";
import { redirect } from "next/navigation";
import { CancellationRequestModal } from "@/components/cancellation-request-modal";
import { CheckoutEmbed } from "@/components/embedded-checkout";
import { ScreenSubscriptionForm } from "@/components/screen-subscription-form";
import { requireManager } from "@/lib/auth";
import {
  fulfillCheckoutSession,
  previewLicenseIncreaseAmount,
} from "@/lib/billing-sync";
import { devOrganizationEntitlements, whenDevBypass } from "@/lib/dev-bypass";
import { getOrganizationEntitlements } from "@/lib/entitlements";
import { monthlySubscriptionAmount, SCREEN_MONTHLY_PRICE } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  requestSubscriptionCancellation,
  resumeSubscription,
  scheduleLicenseDecrease,
} from "./actions";

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
  if (params.session_id) {
    let fulfilled = false;
    try {
      fulfilled = await fulfillCheckoutSession({
        sessionId: params.session_id,
        organizationId,
      });
    } catch (error) {
      console.error("Checkout fulfillment failed", error);
    }
    if (fulfilled) redirect("/dashboard/billing?checkout=success");
  }
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
  const licensed = Number(organization.screen_license_quantity ?? 1);
  const quantity = Math.max(1, Number(params.quantity ?? licensed));
  const hasActiveSubscription = Boolean(
    subscription?.stripe_subscription_id &&
      ["active", "trialing"].includes(String(subscription.status)),
  );
  const currency = organization.billing_currency === "usd" ? "USD" : "CAD";
  const estimate = monthlySubscriptionAmount(quantity);
  const currentMonthly = monthlySubscriptionAmount(licensed);
  const changes = changeResult.data ?? [];
  const refunds = refundResult.data ?? [];
  const action = params.action;
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const canceledAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);

  let dueTodayCents = 0;
  if (
    hasActiveSubscription &&
    organization.stripe_customer_id &&
    subscription?.stripe_subscription_id &&
    subscription?.stripe_subscription_item_id &&
    quantity > licensed
  ) {
    dueTodayCents = await previewLicenseIncreaseAmount({
      customerId: organization.stripe_customer_id,
      subscriptionId: subscription.stripe_subscription_id,
      subscriptionItemId: subscription.stripe_subscription_item_id,
      currentQuantity: licensed,
      targetQuantity: quantity,
    });
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">Subscription</p><h1>Billing</h1></div>
      </header>
      {params.error === "deactivate-screens" && (
        <p className="notice danger">
          Deactivate screens on the Screens page before reducing licenses below {activeScreens}.{" "}
          <Link href="/dashboard/screens">Open screens</Link>
        </p>
      )}
      {params.error === "reduce-higher" && <p className="notice danger">Choose a lower license total to reduce at renewal.</p>}
      {params.checkout === "success" && <p className="notice success">Payment confirmed. Your screen licenses are now active.</p>}
      {params.session_id && <p className="notice">Payment was received. Refresh this page if your licenses are not updated yet.</p>}
      {params.updated && <p className="notice success">Your license change was scheduled for the next renewal.</p>}
      {params.canceled === "scheduled" && <p className="notice">Your subscription will cancel at the end of the current period. Screens stay online until then.</p>}
      {params.canceled === "resumed" && <p className="notice success">Your subscription will continue.</p>}
      {params.refund === "submitted" && <p className="notice success">Your refund request was submitted for review.</p>}
      {params.refund === "expired" && <p className="notice danger">That license change is outside the seven-day refund window.</p>}
      {params.refund === "duplicate" && <p className="notice danger">A refund request already exists for that license change.</p>}
      {params.refund === "missing-reason" && <p className="notice danger">Please include a reason for the refund request.</p>}
      <section className="stat-grid">
        <article className="stat-card"><span>Service</span><strong className="status-text">{access.serviceState}</strong></article>
        <article className="stat-card"><span>Screen licenses</span><strong>{licensed}</strong></article>
        <article className="stat-card"><span>Active screens</span><strong>{activeScreens}</strong></article>
        <article className="stat-card"><span>Monthly price</span><strong>{currency} ${currentMonthly}</strong></article>
      </section>
      {canceledAtPeriodEnd && periodEnd && hasActiveSubscription && (
        <section className="notice">
          <p>Cancels on {periodEnd.toLocaleDateString()}. After that, licenses expire and players disconnect.</p>
          <form action={resumeSubscription}>
            <button className="button secondary compact-button">Keep subscription</button>
          </form>
        </section>
      )}
      {!hasActiveSubscription ? (
        <ScreenSubscriptionForm
          currency={currency}
          submitLabel={
            organization.status === "canceled" || organization.status === "suspended"
              ? "Resubscribe"
              : "Subscribe now"
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Account subscription</p>
              <h2>Screen licenses</h2>
            </div>
          </div>
          <p className="muted">
            {currency} ${SCREEN_MONTHLY_PRICE} per screen each month. No discounts.
            {periodEnd ? ` Next renewal ${periodEnd.toLocaleDateString()}.` : ""}
          </p>
          {subscription?.pending_quantity != null && (
            <p className="notice">Scheduled quantity at renewal: {subscription.pending_quantity}</p>
          )}
          <div className="actions">
            <Link className="button" href="/dashboard/billing?action=add-licenses">Add licenses</Link>
            <Link className="button secondary" href="/dashboard/billing?action=reduce-licenses">Reduce licenses</Link>
            {!canceledAtPeriodEnd && (
              <Link className="button danger" href="/dashboard/billing?action=cancel">Cancel subscription</Link>
            )}
          </div>
        </section>
      )}
      {hasActiveSubscription && action === "add-licenses" && (
        <section className="panel billing-quantity">
          <h2>Add licenses</h2>
          <p className="muted">Set the total number of screens you want to manage. Payment is collected in checkout before licenses increase.</p>
          <form method="get" className="inline-form">
            <input type="hidden" name="action" value="add-licenses" />
            <label>
              Total screen licenses
              <input name="quantity" type="number" min={licensed + 1} max="500" defaultValue={Math.max(quantity, licensed + 1)} />
            </label>
            <button className="button secondary">Review total</button>
          </form>
          <p>
            New monthly total: <strong>{currency} ${estimate}</strong>
            {quantity > licensed ? <> · Due today: <strong>{money(dueTodayCents, currency)}</strong></> : null}
          </p>
          {quantity > licensed && (
            <Link className="button" href={`/dashboard/billing?action=add-licenses&quantity=${quantity}&pay=1`}>
              Pay {money(dueTodayCents, currency)}
            </Link>
          )}
        </section>
      )}
      {hasActiveSubscription && action === "add-licenses" && params.pay === "1" && quantity > licensed && (
        <section className="panel checkout-panel">
          <CheckoutEmbed quantity={quantity} kind="license_increase" />
        </section>
      )}
      {hasActiveSubscription && action === "reduce-licenses" && (
        <section className="panel billing-quantity">
          <h2>Reduce licenses</h2>
          <p className="muted">
            Decreases apply at the next renewal and are not charged today. Deactivate extra screens first if you currently have {activeScreens} active.
          </p>
          <form action={scheduleLicenseDecrease} className="inline-form">
            <label>
              Total screen licenses
              <input name="quantity" type="number" min="1" max={Math.max(1, licensed - 1)} defaultValue={Math.max(1, licensed - 1)} />
            </label>
            <button className="button">Schedule reduction</button>
          </form>
        </section>
      )}
      {hasActiveSubscription && action === "cancel" && !canceledAtPeriodEnd && (
        <section className="panel">
          <h2>Cancel subscription</h2>
          <p className="muted">
            Your screens stay online until {periodEnd ? periodEnd.toLocaleDateString() : "the end of the current period"}.
            After that, licenses expire and players disconnect. Screen records stay so you can resubscribe later.
          </p>
          <form action={requestSubscriptionCancellation} className="stack">
            <label>
              Reason (optional)
              <textarea name="reason" placeholder="Why are you canceling?" />
            </label>
            <button className="button danger">Cancel at period end</button>
          </form>
        </section>
      )}
      <section className="panel table-wrap">
        <h2>Transactions</h2>
        {!changes.length && !refunds.length ? <p className="muted">No refundable license additions yet.</p> : (
          <table>
            <thead><tr><th>Change</th><th>Refund window</th><th>Amount</th><th>Status</th><th></th></tr></thead>
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
                        <CancellationRequestModal licenseChangeId={change.id} />
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
