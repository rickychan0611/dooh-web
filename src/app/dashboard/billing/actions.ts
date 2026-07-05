"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import {
  EXTRA_SCREEN_MONTHLY_PRICE,
  REFUND_WINDOW_DAYS,
  getStripe,
  stripeMonthlyPriceId,
} from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function integer(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function createEmbeddedCheckout(input: {
  quantity: number;
}) {
  const { organizationId, organization, user } = await requireManager();
  const quantity = Math.max(1, Math.min(500, Math.trunc(input.quantity)));
  const stripe = getStripe();
  const currency = organization.billing_currency === "usd" ? "usd" : "cad";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded_page",
    line_items: [
      {
        price: stripeMonthlyPriceId(currency),
        quantity,
      },
    ],
    customer: organization.stripe_customer_id || undefined,
    customer_email: organization.stripe_customer_id
      ? undefined
      : user.email ?? undefined,
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { organization_id: organizationId },
    },
    metadata: { organization_id: organizationId },
    return_url: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
  });
  return session.client_secret ?? "";
}

export async function openCustomerPortal() {
  const { organization } = await requireManager();
  if (!organization.stripe_customer_id) redirect("/dashboard/billing");
  const session = await getStripe().billingPortal.sessions.create({
    customer: organization.stripe_customer_id,
    return_url: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });
  redirect(session.url);
}

export async function updateScreenLicenses(formData: FormData) {
  const { organizationId, organization, user } = await requireManager();
  const quantity = Math.min(500, integer(formData.get("quantity")));
  const admin = getSupabaseAdmin();
  const { data: subscription } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single();
  if (!subscription?.stripe_subscription_item_id) {
    redirect(`/dashboard/billing?quantity=${quantity}`);
  }

  const current = Number(organization.screen_license_quantity ?? 0);
  if (quantity > current) {
    const stripe = getStripe();
    const stripeItem = await stripe.subscriptionItems.update(
      subscription.stripe_subscription_item_id,
      { quantity, proration_behavior: "always_invoice" },
    );
    let invoiceId: string | null = null;
    let paymentIntentId: string | null = null;
    try {
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripe_subscription_id,
        limit: 1,
      });
      const invoice: any = invoices.data[0];
      invoiceId = invoice?.id ?? null;
      paymentIntentId =
        typeof invoice?.payment_intent === "string"
          ? invoice.payment_intent
          : invoice?.payment_intent?.id ?? null;
    } catch {
      invoiceId = null;
      paymentIntentId = null;
    }
    await admin
      .from("organizations")
      .update({ screen_license_quantity: quantity, updated_at: new Date().toISOString() })
      .eq("id", organizationId);
    await admin
      .from("billing_subscriptions")
      .update({ quantity, pending_quantity: null, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    const additionalScreens = quantity - current;
    await admin.from("license_change_events").insert({
      organization_id: organizationId,
      changed_by: user.id,
      previous_quantity: current,
      new_quantity: quantity,
      amount_cents: additionalScreens * EXTRA_SCREEN_MONTHLY_PRICE * 100,
      currency: organization.billing_currency === "usd" ? "usd" : "cad",
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_invoice_id: invoiceId,
      stripe_payment_intent_id: paymentIntentId,
      refundable_until: new Date(Date.now() + REFUND_WINDOW_DAYS * 86400000).toISOString(),
      metadata: { stripeSubscriptionItemId: stripeItem.id },
    });
  } else if (quantity < current) {
    const { count } = await admin
      .from("screens")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if ((count ?? 0) > quantity) {
      redirect("/dashboard/billing?error=deactivate-screens");
    }
    await admin
      .from("billing_subscriptions")
      .update({ pending_quantity: quantity, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    await admin.from("license_change_events").insert({
      organization_id: organizationId,
      changed_by: user.id,
      previous_quantity: current,
      new_quantity: quantity,
      amount_cents: 0,
      currency: organization.billing_currency === "usd" ? "usd" : "cad",
      stripe_subscription_id: subscription.stripe_subscription_id,
      metadata: { pendingAtRenewal: true },
    });
  }
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "billing.license_quantity_changed",
    targetType: "subscription",
    targetId: subscription.stripe_subscription_id,
    metadata: { previous: current, requested: quantity },
  });
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/screens");
  redirect("/dashboard/billing?updated=1");
}

export async function submitRefundApplication(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const changeId = String(formData.get("licenseChangeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect("/dashboard/billing?refund=missing-reason");

  const admin = getSupabaseAdmin();
  const { data: change } = await admin
    .from("license_change_events")
    .select("*")
    .eq("id", changeId)
    .eq("organization_id", organizationId)
    .gt("delta", 0)
    .gt("amount_cents", 0)
    .maybeSingle();
  if (!change || !change.refundable_until || new Date(change.refundable_until).getTime() < Date.now()) {
    redirect("/dashboard/billing?refund=expired");
  }

  const { error } = await admin.from("refund_applications").insert({
    organization_id: organizationId,
    license_change_id: change.id,
    requested_by: user.id,
    reason,
    requested_amount_cents: change.amount_cents,
    currency: change.currency,
  });
  if (error?.code === "23505") redirect("/dashboard/billing?refund=duplicate");
  if (error) throw error;

  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "billing.refund_application_submitted",
    targetType: "license_change",
    targetId: change.id,
    metadata: { amountCents: change.amount_cents },
  });
  if (user.email) {
    await sendTransactionalEmail({
      to: user.email,
      subject: "Refund request received",
      heading: "We received your refund request",
      body: "A platform admin will review your request and update the status in your billing page.",
      actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      actionLabel: "Open billing",
      idempotencyKey: `refund-application-${change.id}`,
    });
  }
  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?refund=submitted");
}
