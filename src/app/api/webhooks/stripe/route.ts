import type Stripe from "stripe";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function iso(unixSeconds?: number | null) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

async function ownerEmail(organizationId: string) {
  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!membership?.user_id) return null;
  const { data } = await admin.auth.admin.getUserById(membership.user_id);
  return data.user?.email ?? null;
}

async function syncSubscription(subscription: any, eventCreated: number) {
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
  const status = active ? "active" : pastDue ? "grace" : "suspended";
  const graceEndsAt = pastDue
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

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
      current_period_start: iso(subscription.current_period_start),
      current_period_end: iso(subscription.current_period_end),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      last_stripe_event_created: eventCreated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  const organizationUpdate: Record<string, unknown> = {
    status,
    grace_ends_at: graceEndsAt,
    suspended_at: status === "suspended" ? new Date().toISOString() : null,
    deletion_scheduled_at:
      status === "suspended"
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
  return true;
}

async function processEvent(event: Stripe.Event) {
  const admin = getSupabaseAdmin();
  if (event.type === "checkout.session.completed") {
    const session: any = event.data.object;
    const organizationId = session.metadata?.organization_id;
    if (!organizationId) return null;
    await admin
      .from("organizations")
      .update({
        stripe_customer_id: String(session.customer),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    if (session.subscription) {
      const subscription = await getStripe().subscriptions.retrieve(
        String(session.subscription),
      );
      await syncSubscription(subscription, event.created);
    }
    const email = await ownerEmail(organizationId);
    if (email) {
      await sendTransactionalEmail({
        to: email,
        subject: "Your DOOH Community subscription is active",
        heading: "Your screens are ready",
        body: "Payment was confirmed. You can add screen licenses, upload promotions, and pair your displays from the dashboard.",
        actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard`,
        actionLabel: "Open dashboard",
        idempotencyKey: `stripe-${event.id}`,
      });
    }
    return organizationId;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription: any = event.data.object;
    await syncSubscription(subscription, event.created);
    return subscription.metadata?.organization_id ?? null;
  }

  if (event.type === "invoice.payment_failed") {
    const invoice: any = event.data.object;
    const subscriptionId =
      invoice.parent?.subscription_details?.subscription ??
      invoice.subscription;
    if (!subscriptionId) return null;
    const subscription: any = await getStripe().subscriptions.retrieve(
      String(subscriptionId),
    );
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return null;
    const { data: current } = await admin
      .from("billing_subscriptions")
      .select("last_stripe_event_created")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (Number(current?.last_stripe_event_created ?? 0) > event.created) {
      return organizationId;
    }
    const graceEndsAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await admin
      .from("organizations")
      .update({
        status: "grace",
        grace_ends_at: graceEndsAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    await admin
      .from("billing_subscriptions")
      .update({
        status: String(subscription.status),
        last_stripe_event_created: event.created,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
    const email = await ownerEmail(organizationId);
    if (email) {
      await sendTransactionalEmail({
        to: email,
        subject: "Payment failed for DOOH Community",
        heading: "Please update your payment method",
        body: "Your screens will keep running for seven days. Update your payment method before the grace period ends to avoid interruption.",
        actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
        actionLabel: "Fix payment",
        idempotencyKey: `stripe-${event.id}`,
      });
    }
    return organizationId;
  }

  if (event.type === "invoice.paid") {
    const invoice: any = event.data.object;
    const subscriptionId =
      invoice.parent?.subscription_details?.subscription ??
      invoice.subscription;
    if (!subscriptionId) return null;
    const subscription: any = await getStripe().subscriptions.retrieve(
      String(subscriptionId),
    );
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return null;
    const synchronized = await syncSubscription(subscription, event.created);
    if (!synchronized) return organizationId;
    const { data: billing } = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .single();
    if (
      billing?.pending_quantity != null &&
      billing.stripe_subscription_item_id
    ) {
      await getStripe().subscriptionItems.update(
        billing.stripe_subscription_item_id,
        {
          quantity: billing.pending_quantity,
          proration_behavior: "none",
        },
      );
      await admin
        .from("organizations")
        .update({
          screen_license_quantity: billing.pending_quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);
      await admin
        .from("billing_subscriptions")
        .update({
          quantity: billing.pending_quantity,
          pending_quantity: null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId);
    }
    return organizationId;
  }

  if (event.type === "charge.refunded") {
    const charge: any = event.data.object;
    if (!charge.customer) return null;
    const { data: organization } = await admin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", String(charge.customer))
      .maybeSingle();
    if (!organization) return null;
    const email = await ownerEmail(organization.id);
    if (email) {
      await sendTransactionalEmail({
        to: email,
        subject: "DOOH Community refund processed",
        heading: "Your refund was recorded",
        body: "Stripe processed a refund for your account. Your subscription status and future invoices remain available in the billing portal.",
        actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
        actionLabel: "Open billing",
        idempotencyKey: `stripe-${event.id}`,
      });
    }
    return organization.id;
  }

  return null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getEnv().STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error: claimError } = await admin.from("billing_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as any,
  });
  if (claimError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }
  if (claimError) {
    return Response.json({ error: "Could not claim webhook" }, { status: 500 });
  }

  try {
    const organizationId = await processEvent(event);
    await admin
      .from("billing_events")
      .update({
        organization_id: organizationId,
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);
    if (organizationId) {
      await admin.from("audit_logs").insert({
        organization_id: organizationId,
        actor_type: "stripe",
        action: `stripe.${event.type}`,
        target_type: "billing_event",
        target_id: event.id,
      });
    }
    return Response.json({ received: true });
  } catch (error) {
    await admin
      .from("billing_events")
      .delete()
      .eq("stripe_event_id", event.id);
    console.error("Stripe webhook failed", event.id, error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
