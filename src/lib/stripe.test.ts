import { describe, expect, it } from "vitest";
import { monthlySubscriptionAmount, SCREEN_MONTHLY_PRICE } from "./stripe";

describe("stripe pricing helpers", () => {
  it("charges nine dollars per screen with no discount", () => {
    expect(SCREEN_MONTHLY_PRICE).toBe(9);
    expect(monthlySubscriptionAmount(1)).toBe(9);
    expect(monthlySubscriptionAmount(3)).toBe(27);
    expect(monthlySubscriptionAmount(4)).toBe(36);
    expect(monthlySubscriptionAmount(6)).toBe(54);
  });
});
