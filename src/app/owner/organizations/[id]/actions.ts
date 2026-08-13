"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { disconnectOrganizationPlayers, revertLicensesAfterRefund } from "@/lib/billing-sync";
import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function setOrganizationStatus(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const status = text(formData, "status");
  if (!["trialing", "active", "grace", "suspended", "canceled"].includes(status)) {
    throw new Error("Invalid status.");
  }
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("organizations")
    .update({
      status,
      grace_ends_at:
        status === "grace"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : null,
      suspended_at: status === "suspended" ? now : null,
      deletion_scheduled_at:
        status === "suspended"
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null,
      updated_at: now,
    })
    .eq("id", organizationId);
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.organization_status_changed",
    targetType: "organization",
    targetId: organizationId,
    metadata: { status },
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function resumeOrganizationSubscription(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const admin = getSupabaseAdmin();
  const { data: billing } = await admin
    .from("billing_subscriptions")
    .select("stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!billing?.stripe_subscription_id) {
    throw new Error("This organization has no Stripe subscription.");
  }
  await getStripe().subscriptions.update(billing.stripe_subscription_id, {
    cancel_at_period_end: false,
  });
  await admin
    .from("billing_subscriptions")
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.subscription_resumed",
    targetType: "subscription",
    targetId: billing.stripe_subscription_id,
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function cancelOrganizationSubscriptionNow(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const admin = getSupabaseAdmin();
  const { data: billing } = await admin
    .from("billing_subscriptions")
    .select("stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (billing?.stripe_subscription_id) {
    await getStripe().subscriptions.cancel(billing.stripe_subscription_id);
  }
  await disconnectOrganizationPlayers(organizationId, "canceled");
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.subscription_canceled_now",
    targetType: "subscription",
    targetId: billing?.stripe_subscription_id ?? organizationId,
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function addSupportNote(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const body = text(formData, "body");
  if (!body) return;
  const { error } = await getSupabaseAdmin()
    .from("organization_support_notes")
    .insert({ organization_id: organizationId, author_user_id: user.id, body });
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.support_note_added",
    targetType: "organization",
    targetId: organizationId,
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function setFeatureFlag(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const flag = text(formData, "flag");
  const enabled = formData.get("enabled") === "on";
  const { error } = await getSupabaseAdmin()
    .from("organization_feature_flags")
    .upsert(
      {
        organization_id: organizationId,
        flag,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,flag" },
    );
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.feature_flag_changed",
    targetType: "feature_flag",
    targetId: flag,
    metadata: { enabled },
  });
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function rejectRefundApplication(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const refundId = text(formData, "refundId");
  const note = text(formData, "reviewNote") || "Refund request rejected.";
  const admin = getSupabaseAdmin();
  const { data: refund, error } = await admin
    .from("refund_applications")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", refundId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw error;
  await writeAudit({
    organizationId,
    actorUserId: user.id,
    actorType: "platform",
    action: "platform.refund_application_rejected",
    targetType: "refund_application",
    targetId: refundId,
  });
  if (refund.requested_by) {
    const { data } = await admin.auth.admin.getUserById(refund.requested_by);
    if (data.user?.email) {
      await sendTransactionalEmail({
        to: data.user.email,
        subject: "Refund request update",
        heading: "Your refund request was reviewed",
        body: note,
        actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
        actionLabel: "Open billing",
        idempotencyKey: `refund-rejected-${refundId}`,
      });
    }
  }
  revalidatePath(`/owner/organizations/${organizationId}`);
}

export async function issueRefundApplication(formData: FormData) {
  const user = await requirePlatformOwner();
  const organizationId = text(formData, "organizationId");
  const refundId = text(formData, "refundId");
  const note = text(formData, "reviewNote") || "Refund approved.";
  const admin = getSupabaseAdmin();
  const { data: refund } = await admin
    .from("refund_applications")
    .select("*, license_change_events(*)")
    .eq("id", refundId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!refund || !["pending", "approved", "failed"].includes(refund.status)) {
    throw new Error("Refund application is not refundable.");
  }

  const paymentIntent = refund.license_change_events?.stripe_payment_intent_id;
  if (!paymentIntent) {
    const { error } = await admin
      .from("refund_applications")
      .update({
        status: "failed",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        failure_message: "No Stripe payment intent was recorded for this license change.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", refundId);
    if (error) throw error;
    revalidatePath(`/owner/organizations/${organizationId}`);
    return;
  }

  try {
    const stripeRefund = await getStripe().refunds.create({
      payment_intent: paymentIntent,
      amount: refund.requested_amount_cents,
      metadata: {
        organization_id: organizationId,
        refund_application_id: refundId,
        license_change_id: refund.license_change_id,
      },
    });
    const { error } = await admin
      .from("refund_applications")
      .update({
        status: "refunded",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        stripe_refund_id: stripeRefund.id,
        failure_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", refundId);
    if (error) throw error;
    const change = refund.license_change_events;
    const reverted = change
      ? await revertLicensesAfterRefund({
          organizationId,
          previousQuantity: Number(change.previous_quantity ?? 0),
          newQuantity: Number(change.new_quantity ?? 0),
          refundApplicationId: refundId,
          licenseChangeId: change.id,
        })
      : { targetQuantity: null, deactivated: 0 };
    await writeAudit({
      organizationId,
      actorUserId: user.id,
      actorType: "platform",
      action: "platform.refund_issued",
      targetType: "refund_application",
      targetId: refundId,
      metadata: {
        stripeRefundId: stripeRefund.id,
        amountCents: refund.requested_amount_cents,
        licenses: reverted.targetQuantity,
        screensDeactivated: reverted.deactivated,
      },
    });
    if (refund.requested_by) {
      const { data } = await admin.auth.admin.getUserById(refund.requested_by);
      if (data.user?.email) {
        await sendTransactionalEmail({
          to: data.user.email,
          subject: "Refund processed",
          heading: "Your refund was processed",
          body: reverted.targetQuantity
            ? `A platform admin issued the refund and reduced your screen licenses to ${reverted.targetQuantity}. Extra screens were deactivated and those players were disconnected.`
            : "A platform admin approved your request and issued the refund in Stripe.",
          actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
          actionLabel: "Open billing",
          idempotencyKey: `refund-issued-${refundId}`,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe refund failed.";
    await admin
      .from("refund_applications")
      .update({
        status: "failed",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        failure_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", refundId);
    throw error;
  }
  revalidatePath(`/owner/organizations/${organizationId}`);
  revalidatePath("/owner");
}
