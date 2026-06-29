"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { writeAudit } from "@/lib/authorization";
import { getEnv } from "@/lib/env";
import { getStripe, stripePriceId } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function integer(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function createEmbeddedCheckout(input: {
  interval: "month" | "year";
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
        price: stripePriceId(currency, input.interval),
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
    await getStripe().subscriptionItems.update(
      subscription.stripe_subscription_item_id,
      { quantity, proration_behavior: "always_invoice" },
    );
    await admin
      .from("organizations")
      .update({ screen_license_quantity: quantity, updated_at: new Date().toISOString() })
      .eq("id", organizationId);
    await admin
      .from("billing_subscriptions")
      .update({ quantity, pending_quantity: null, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
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
