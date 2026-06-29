import { isDevAuthBypassEnabled } from "@/lib/env";
import type { ServiceState } from "@/lib/subscription-state";

export function whenDevBypass<T>(fallback: T, load: () => Promise<T>): Promise<T> {
  if (isDevAuthBypassEnabled()) {
    return Promise.resolve(fallback);
  }
  return load();
}

export function devOrganizationEntitlements(organizationId: string) {
  const organization = {
    id: organizationId,
    status: "trialing",
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    screen_license_quantity: 1,
    billing_currency: "cad",
  };
  const entitlements = { storage_bytes_per_license: 1073741824 };
  return {
    organization,
    entitlements,
    serviceState: "active" as ServiceState,
    licensedScreens: 1,
    storageLimitBytes: 1073741824,
  };
}

export const DEV_DEFAULT_SETTINGS = {
  default_message_duration: 12,
  per_submitter_limit: 3,
  per_submitter_window_minutes: 10,
  per_screen_hour_limit: 10,
  blocked_words: [] as string[],
};
