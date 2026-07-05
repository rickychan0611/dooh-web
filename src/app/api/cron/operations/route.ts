import { sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function organizationOwnerEmail(organizationId: string) {
  const admin = getSupabaseAdmin();
  const { data: owner } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner) return null;
  const { data } = await admin.auth.admin.getUserById(owner.user_id);
  return data.user?.email ?? null;
}

async function alreadySent(
  organizationId: string,
  action: string,
  since: string,
) {
  const { count } = await getSupabaseAdmin()
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("action", action)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

async function record(organizationId: string, action: string, metadata = {}) {
  await getSupabaseAdmin().from("audit_logs").insert({
    organization_id: organizationId,
    actor_type: "system",
    action,
    target_type: "organization",
    target_id: organizationId,
    metadata,
  });
}

export async function GET(request: Request) {
  if (
    !getEnv().CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${getEnv().CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const now = Date.now();
  const { data: organizations } = await admin
    .from("organizations")
    .select("*")
    .in("status", ["trialing", "active", "grace"]);
  let emails = 0;
  let suspensions = 0;

  for (const organization of organizations ?? []) {
    if (
      organization.status === "trialing" &&
      new Date(organization.trial_ends_at).getTime() <= now
    ) {
      await admin
        .from("organizations")
        .update({
          status: "suspended",
          suspended_at: new Date().toISOString(),
          deletion_scheduled_at: new Date(now + 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);
      await record(organization.id, "trial.expired");
      suspensions += 1;
      continue;
    }
    if (
      organization.status === "grace" &&
      organization.grace_ends_at &&
      new Date(organization.grace_ends_at).getTime() <= now
    ) {
      await admin
        .from("organizations")
        .update({
          status: "suspended",
          suspended_at: new Date().toISOString(),
          deletion_scheduled_at: new Date(now + 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);
      await record(organization.id, "billing.grace_expired");
      suspensions += 1;
      continue;
    }

    const ownerEmail = await organizationOwnerEmail(organization.id);
    if (!ownerEmail) continue;
    if (organization.status === "trialing") {
      const daysLeft = Math.ceil(
        (new Date(organization.trial_ends_at).getTime() - now) / 86400000,
      );
      if ([1, 3].includes(daysLeft)) {
        const action = `trial.reminder_${daysLeft}_days`;
        if (
          !(await alreadySent(
            organization.id,
            action,
            new Date(now - 7 * 86400000).toISOString(),
          ))
        ) {
          await sendTransactionalEmail({
            to: ownerEmail,
            subject: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your DOOH Community trial`,
            heading: "Keep your screen running",
            body: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Start the monthly plan before it ends to keep your screens running.`,
            actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/billing`,
            actionLabel: "Choose a plan",
            idempotencyKey: `${action}-${organization.id}`,
          });
          await record(organization.id, action);
          emails += 1;
        }
      }
    }

    const { data: offlineScreens } = await admin
      .from("screens")
      .select("id,name,last_heartbeat_at")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .not("last_heartbeat_at", "is", null)
      .lt("last_heartbeat_at", new Date(now - 15 * 60000).toISOString());
    if (
      offlineScreens?.length &&
      !(await alreadySent(
        organization.id,
        "screen.offline_alert_sent",
        new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      ))
    ) {
      await sendTransactionalEmail({
        to: ownerEmail,
        subject: `${offlineScreens.length} screen${offlineScreens.length === 1 ? "" : "s"} offline`,
        heading: "A screen needs attention",
        body: `${offlineScreens.map((screen: any) => screen.name).join(", ")} stopped reporting to DOOH Community.`,
        actionUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/dashboard/screens`,
        actionLabel: "Check screens",
        idempotencyKey: `offline-${organization.id}-${new Date().toISOString().slice(0, 10)}`,
      });
      await record(organization.id, "screen.offline_alert_sent", {
        screenIds: offlineScreens.map((screen: any) => screen.id),
      });
      emails += 1;
    }
  }
  return Response.json({ ok: true, emails, suspensions });
}
