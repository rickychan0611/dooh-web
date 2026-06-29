import { describe, expect, it } from "vitest";
import { serviceState } from "./subscription-state";

describe("subscription service state", () => {
  it("keeps valid trials and grace periods active", () => {
    expect(
      serviceState({
        status: "trialing",
        trial_ends_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toBe("active");
    expect(
      serviceState({
        status: "grace",
        grace_ends_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toBe("grace");
  });

  it("suspends expired trials and grace periods", () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    expect(
      serviceState({ status: "trialing", trial_ends_at: expired }),
    ).toBe("suspended");
    expect(
      serviceState({ status: "grace", grace_ends_at: expired }),
    ).toBe("suspended");
  });
});
