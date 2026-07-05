import { describe, expect, it } from "vitest";
import {
  BASE_MONTHLY_PRICE,
  EXTRA_SCREEN_MONTHLY_PRICE,
  INCLUDED_SCREENS,
  monthlySubscriptionAmount,
} from "./stripe";

describe("stripe pricing helpers", () => {
  it("charges the base price through the included screen count", () => {
    expect(INCLUDED_SCREENS).toBe(3);
    expect(BASE_MONTHLY_PRICE).toBe(9);
    expect(monthlySubscriptionAmount(1)).toBe(9);
    expect(monthlySubscriptionAmount(3)).toBe(9);
  });

  it("adds three dollars for each screen above the included count", () => {
    expect(EXTRA_SCREEN_MONTHLY_PRICE).toBe(3);
    expect(monthlySubscriptionAmount(4)).toBe(12);
    expect(monthlySubscriptionAmount(6)).toBe(18);
  });
});
