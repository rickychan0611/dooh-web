"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import {
  applyPaidLicenseIncrease,
  previewLicenseIncreaseAmount,
} from "@/lib/billing-sync";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getStripe, stripeMonthlyPriceId } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function integer(value: FormDataEntryValue | string | null, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function loadBillingSubscription(organizationId: string) {
  const { data } = await getSupabaseAdmin()
    .from("billing_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

export async function createEmbeddedCheckout(input: {
  quantity: number;
  kind?: "subscribe" | "license_increase";
}) {
  const { organizationId, organization, user } = await requireManager();
  const quantity = Math.max(1, Math.min(500, Math.trunc(input.quantity)));
  const stripe = getStripe();
  const currency = organization.billing_currency === "usd" ? "usd" : "cad";
  const returnUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=complete&session_id={CHECKOUT_SESSION_ID}`;
  const billing = await loadBillingSubscription(organizationId);
  const hasActiveSubscription = Boolean(
    billing?.stripe_subscription_id &&
      ["active", "trialing"].includes(String(billing.status)),
  );

  if (hasActiveSubscription && input.kind === "license_increase") {
    const current = Number(organization.screen_license_quantity ?? 0);
    if (quantity <= current) {
      throw new Error("Choose a higher license total to check out.");
    }
    const amountDue = await previewLicenseIncreaseAmount({
      customerId: String(organization.stripe_customer_id),
      subscriptionId: billing.stripe_subscription_id,
      subscriptionItemId: billing.stripe_subscription_item_id,
      currentQuantity: current,
      targetQuantity: quantity,
    });
    if (amountDue <= 0) {
      await applyPaidLicenseIncrease({
        organizationId,
        targetQuantity: quantity,
        amountCents: 0,
        changedBy: user.id,
      });
      redirect("/dashboard/billing?checkout=success");
    }
    const extra = quantity - current;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      customer: organization.stripe_customer_id,
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${extra} additional screen license${extra === 1 ? "" : "s"}`,
              description: `Increase from ${current} to ${quantity} screens`,
            },
            unit_amount: amountDue,
          },
          quantity: 1,
        },
      ],
      metadata: {
        organization_id: organizationId,
        checkout_kind: "license_increase",
        target_quantity: String(quantity),
      },
      return_url: returnUrl,
    });
    return session.client_secret ?? "";
  }

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
    metadata: { organization_id: organizationId, checkout_kind: "subscribe" },
    return_url: returnUrl,
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

export async function scheduleLicenseDecrease(formData: FormData) {
  const { organizationId, organization, user } = await requireManager();
  const quantity = Math.min(500, integer(formData.get("quantity")));
  const admin = getSupabaseAdmin();
  const subscription = await loadBillingSubscription(organizationId);
  if (!subscription?.stripe_subscription_item_id) {
    redirect(`/dashboard/billing?action=add-licenses&quantity=${quantity}`);
  }

  const current = Number(organization.screen_license_quantity ?? 0);
  if (quantity >= current) {
    redirect("/dashboard/billing?error=reduce-higher");
  }
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
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "billing.license_quantity_changed",
    targetType: "subscription",
    targetId: subscription.stripe_subscription_id,
    metadata: { previous: current, requested: quantity, pendingAtRenewal: true },
  });
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/screens");
  redirect("/dashboard/billing?updated=1");
}

export async function requestSubscriptionCancellation(formData: FormData) {
  const { organizationId, user } = await requireManager();
  const reason = String(formData.get("reason") ?? "").trim();
  const subscription = await loadBillingSubscription(organizationId);
  if (!subscription?.stripe_subscription_id) {
    redirect("/dashboard/billing");
  }
  await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });
  await getSupabaseAdmin()
    .from("billing_subscriptions")
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "billing.subscription_cancel_requested",
    targetType: "subscription",
    targetId: subscription.stripe_subscription_id,
    metadata: { reason: reason || null },
  });
  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?canceled=scheduled");
}

export async function resumeSubscription() {
  const { organizationId, user } = await requireManager();
  const subscription = await loadBillingSubscription(organizationId);
  if (!subscription?.stripe_subscription_id) {
    redirect("/dashboard/billing");
  }
  await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });
  await getSupabaseAdmin()
    .from("billing_subscriptions")
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    action: "billing.subscription_resumed",
    targetType: "subscription",
    targetId: subscription.stripe_subscription_id,
  });
  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?canceled=resumed");
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
