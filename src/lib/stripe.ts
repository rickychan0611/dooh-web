import Stripe from "stripe";
import { getEnv } from "./env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secret = getEnv().STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured.");
  if (!stripeClient) stripeClient = new Stripe(secret);
  return stripeClient;
}

export const INCLUDED_SCREENS = 3;
export const BASE_MONTHLY_PRICE = 9;
export const EXTRA_SCREEN_MONTHLY_PRICE = 3;
export const REFUND_WINDOW_DAYS = 7;

export function monthlySubscriptionAmount(quantity: number) {
  const screens = Math.max(1, Math.trunc(quantity));
  return BASE_MONTHLY_PRICE + Math.max(0, screens - INCLUDED_SCREENS) * EXTRA_SCREEN_MONTHLY_PRICE;
}

export function stripeMonthlyPriceId(currency: "cad" | "usd") {
  const env = getEnv();
  const priceId =
    env.STRIPE_PRICE_MONTHLY ||
    (currency === "usd" ? env.STRIPE_PRICE_USD_MONTHLY : env.STRIPE_PRICE_CAD_MONTHLY);
  if (!priceId) throw new Error("Stripe monthly tiered price is not configured.");
  return priceId;
}
