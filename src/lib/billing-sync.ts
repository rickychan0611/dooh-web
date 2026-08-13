import {
  REFUND_WINDOW_DAYS,
  SCREEN_MONTHLY_PRICE,
  getStripe,
} from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function iso(unixSeconds?: number | null) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

export async function disconnectOrganizationPlayers(
  organizationId: string,
  status: "canceled" | "suspended" = "canceled",
) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  await admin
    .from("organizations")
    .update({
      status,
      suspended_at: now,
      deletion_scheduled_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      updated_at: now,
    })
    .eq("id", organizationId);

  const { data: screens } = await admin
    .from("screens")
    .select("id")
    .eq("organization_id", organizationId);
  const screenIds = (screens ?? []).map((screen: { id: string }) => screen.id);
  if (!screenIds.length) return;

  await admin
    .from("screen_devices")
    .update({ revoked_at: now })
    .in("screen_id", screenIds)
    .is("revoked_at", null);
}

export async function syncSubscription(
  subscription: any,
  eventCreated: number,
) {
  const admin = getSupabaseAdmin();
  const organizationId = subscription.metadata?.organization_id;
  if (!organizationId) return false;
  const { data: current } = await admin
    .from("billing_subscriptions")
    .select("last_stripe_event_created")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (Number(current?.last_stripe_event_created ?? 0) > eventCreated) {
    return false;
  }
  const item = subscription.items?.data?.[0];
  const quantity = Number(item?.quantity ?? 0);
  const stripeStatus = String(subscription.status);
  const active = ["active", "trialing"].includes(stripeStatus);
  const pastDue = ["past_due", "unpaid", "incomplete"].includes(stripeStatus);
  const canceled = stripeStatus === "canceled";
  const status = active
    ? "active"
    : pastDue
      ? "grace"
      : canceled
        ? "canceled"
        : "suspended";
  const graceEndsAt = pastDue
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const periodStart =
    item?.current_period_start ?? subscription.current_period_start;
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end;

  await admin.from("billing_subscriptions").upsert(
    {
      organization_id: organizationId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_item_id: item?.id ?? null,
      stripe_price_id: item?.price?.id ?? null,
      status: stripeStatus,
      currency: item?.price?.currency ?? "cad",
      billing_interval: item?.price?.recurring?.interval ?? "month",
      quantity,
      current_period_start: iso(periodStart),
      current_period_end: iso(periodEnd),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      last_stripe_event_created: eventCreated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  const organizationUpdate: Record<string, unknown> = {
    status,
    grace_ends_at: graceEndsAt,
    suspended_at: status === "suspended" || status === "canceled" ? new Date().toISOString() : null,
    deletion_scheduled_at:
      status === "suspended" || status === "canceled"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };
  if (active && quantity > 0) {
    organizationUpdate.screen_license_quantity = quantity;
  }
  await admin
    .from("organizations")
    .update(organizationUpdate)
    .eq("id", organizationId);

  if (canceled) {
    await disconnectOrganizationPlayers(organizationId, "canceled");
  }
  return true;
}

export async function applyPaidLicenseIncrease(input: {
  organizationId: string;
  targetQuantity: number;
  amountCents?: number;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  changedBy?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const [{ data: organization }, { data: billing }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, screen_license_quantity, billing_currency")
      .eq("id", input.organizationId)
      .single(),
    admin
      .from("billing_subscriptions")
      .select("*")
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
  ]);
  if (!organization || !billing?.stripe_subscription_item_id) return false;

  const current = Number(organization.screen_license_quantity ?? 0);
  const target = Math.max(1, Math.min(500, Math.trunc(input.targetQuantity)));
  const alreadyApplied =
    current >= target && Number(billing.quantity ?? 0) >= target;

  if (!alreadyApplied) {
    await getStripe().subscriptionItems.update(billing.stripe_subscription_item_id, {
      quantity: target,
      proration_behavior: "none",
    });
    const subscription = await retrieveStripeSubscription(
      billing.stripe_subscription_id,
    );
    await syncSubscription(subscription, Math.floor(Date.now() / 1000));
  }

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: existingChanges } = await admin
    .from("license_change_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("new_quantity", target)
    .gte("created_at", since);
  if ((existingChanges ?? 0) > 0) return true;

  const additionalScreens = Math.max(0, target - current);
  const amountCents =
    input.amountCents ??
    additionalScreens * SCREEN_MONTHLY_PRICE * 100;
  await admin.from("license_change_events").insert({
    organization_id: input.organizationId,
    changed_by: input.changedBy ?? null,
    previous_quantity: current,
    new_quantity: target,
    amount_cents: amountCents,
    currency: organization.billing_currency === "usd" ? "usd" : "cad",
    stripe_subscription_id: billing.stripe_subscription_id,
    stripe_invoice_id: input.stripeInvoiceId ?? null,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    refundable_until: new Date(
      Date.now() + REFUND_WINDOW_DAYS * 86400000,
    ).toISOString(),
    metadata: { checkoutKind: "license_increase" },
  });
  return true;
}

export async function revertLicensesAfterRefund(input: {
  organizationId: string;
  previousQuantity: number;
  newQuantity: number;
  refundApplicationId?: string;
  licenseChangeId?: string;
}) {
  const admin = getSupabaseAdmin();
  const added = Math.max(0, input.newQuantity - input.previousQuantity);
  if (added <= 0) return { targetQuantity: input.previousQuantity, deactivated: 0 };
  if (input.licenseChangeId) {
    const { data: existing } = await admin
      .from("license_change_events")
      .select("metadata")
      .eq("id", input.licenseChangeId)
      .maybeSingle();
    if (existing?.metadata?.refundedAt) {
      return {
        targetQuantity: Number(existing.metadata.refundedToQuantity ?? input.previousQuantity),
        deactivated: 0,
      };
    }
  }

  const [{ data: organization }, { data: billing }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, screen_license_quantity, billing_currency")
      .eq("id", input.organizationId)
      .single(),
    admin
      .from("billing_subscriptions")
      .select("*")
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
  ]);
  if (!organization) {
    return { targetQuantity: input.previousQuantity, deactivated: 0 };
  }

  const current = Number(organization.screen_license_quantity ?? 0);
  const targetQuantity = Math.max(1, current - added);
  const now = new Date().toISOString();

  if (billing?.stripe_subscription_item_id && ["active", "trialing"].includes(String(billing.status))) {
    try {
      await getStripe().subscriptionItems.update(billing.stripe_subscription_item_id, {
        quantity: targetQuantity,
        proration_behavior: "none",
      });
    } catch (error) {
      console.error("Could not update Stripe quantity after refund", error);
    }
  }

  await admin
    .from("organizations")
    .update({
      screen_license_quantity: targetQuantity,
      updated_at: now,
    })
    .eq("id", input.organizationId);

  const billingUpdate: Record<string, unknown> = {
    quantity: targetQuantity,
    updated_at: now,
  };
  if (
    billing?.pending_quantity != null &&
    Number(billing.pending_quantity) > targetQuantity
  ) {
    billingUpdate.pending_quantity = targetQuantity;
  }
  if (billing) {
    await admin
      .from("billing_subscriptions")
      .update(billingUpdate)
      .eq("organization_id", input.organizationId);
  }

  const { data: extraScreens } = await admin
    .from("screens")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const extras = (extraScreens ?? []).slice(
    0,
    Math.max(0, (extraScreens?.length ?? 0) - targetQuantity),
  );
  if (extras.length) {
    const extraIds = extras.map((screen: { id: string }) => screen.id);
    await admin
      .from("screens")
      .update({ is_active: false, updated_at: now })
      .in("id", extraIds);
    await admin
      .from("screen_devices")
      .update({ revoked_at: now })
      .in("screen_id", extraIds)
      .is("revoked_at", null);
  }

  await admin.from("license_change_events").insert({
    organization_id: input.organizationId,
    previous_quantity: current,
    new_quantity: targetQuantity,
    amount_cents: 0,
    currency: organization.billing_currency === "usd" ? "usd" : "cad",
    stripe_subscription_id: billing?.stripe_subscription_id ?? null,
    metadata: {
      refundedLicenseIncrease: true,
      refundApplicationId: input.refundApplicationId ?? null,
      licenseChangeId: input.licenseChangeId ?? null,
    },
  });
  if (input.licenseChangeId) {
    const { data: original } = await admin
      .from("license_change_events")
      .select("metadata")
      .eq("id", input.licenseChangeId)
      .maybeSingle();
    await admin
      .from("license_change_events")
      .update({
        metadata: {
          ...(original?.metadata ?? {}),
          refundedAt: now,
          refundedToQuantity: targetQuantity,
        },
      })
      .eq("id", input.licenseChangeId);
  }

  return { targetQuantity, deactivated: extras.length };
}

export async function revertLicensesForRefundedCharge(input: {
  organizationId: string;
  paymentIntentId?: string | null;
  invoiceId?: string | null;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("license_change_events")
    .select("*")
    .eq("organization_id", input.organizationId)
    .gt("amount_cents", 0)
    .order("created_at", { ascending: false });
  if (input.invoiceId) {
    query = query.eq("stripe_invoice_id", input.invoiceId);
  } else if (input.paymentIntentId) {
    query = query.eq("stripe_payment_intent_id", input.paymentIntentId);
  } else {
    return null;
  }
  const { data: change } = await query.maybeSingle();
  if (!change) return null;
  if (input.paymentIntentId && !change.stripe_payment_intent_id) {
    await admin
      .from("license_change_events")
      .update({ stripe_payment_intent_id: input.paymentIntentId })
      .eq("id", change.id);
  }
  return revertLicensesAfterRefund({
    organizationId: input.organizationId,
    previousQuantity: Number(change.previous_quantity ?? 0),
    newQuantity: Number(change.new_quantity ?? 0),
    licenseChangeId: change.id,
  });
}

export async function previewLicenseIncreaseAmount(input: {
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  currentQuantity: number;
  targetQuantity: number;
}) {
  const extra = Math.max(0, input.targetQuantity - input.currentQuantity);
  const fallback = extra * SCREEN_MONTHLY_PRICE * 100;
  try {
    const preview = await getStripe().invoices.createPreview({
      customer: input.customerId,
      subscription: input.subscriptionId,
      subscription_details: {
        items: [
          {
            id: input.subscriptionItemId,
            quantity: input.targetQuantity,
          },
        ],
        proration_behavior: "always_invoice",
      },
    });
    return Math.max(0, Number(preview.amount_due ?? fallback));
  } catch {
    return fallback;
  }
}

export async function fulfillCheckoutSession(input: {
  sessionId: string;
  organizationId: string;
}) {
  const session = await getStripe().checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription", "payment_intent"],
  });
  const sessionOrganizationId = session.metadata?.organization_id;
  if (!sessionOrganizationId || sessionOrganizationId !== input.organizationId) {
    return false;
  }
  if (session.status !== "complete" && session.payment_status !== "paid") {
    return false;
  }

  const admin = getSupabaseAdmin();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (customerId) {
    await admin
      .from("organizations")
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.organizationId);
  }

  if (session.metadata?.checkout_kind === "license_increase") {
    const targetQuantity = Number(session.metadata.target_quantity ?? 0);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    return applyPaidLicenseIncrease({
      organizationId: input.organizationId,
      targetQuantity,
      amountCents: Number(session.amount_total ?? 0),
      stripeInvoiceId:
        typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null,
      stripePaymentIntentId: paymentIntentId,
    });
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return Boolean(customerId);

  const existingMetadata =
    typeof session.subscription === "object" && session.subscription
      ? session.subscription.metadata?.organization_id
      : null;
  if (!existingMetadata) {
    await getStripe().subscriptions.update(subscriptionId, {
      metadata: { organization_id: input.organizationId },
    });
  }

  const subscription = await retrieveStripeSubscription(subscriptionId);
  await syncSubscription(subscription, Math.floor(Date.now() / 1000));
  return true;
}
