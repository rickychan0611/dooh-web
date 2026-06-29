export type ServiceState = "active" | "grace" | "suspended";

export function serviceState(organization: Record<string, any>): ServiceState {
  const now = Date.now();
  if (
    organization.status === "active" ||
    (organization.status === "trialing" &&
      new Date(organization.trial_ends_at).getTime() > now)
  ) {
    return "active";
  }
  if (
    organization.status === "grace" &&
    organization.grace_ends_at &&
    new Date(organization.grace_ends_at).getTime() > now
  ) {
    return "grace";
  }
  return "suspended";
}
