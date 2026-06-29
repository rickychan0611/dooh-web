import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secret = getEnv().STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured.");
  if (!stripeClient) stripeClient = new Stripe(secret);
  return stripeClient;
}

export function stripePriceId(
  currency: "cad" | "usd",
  interval: "month" | "year",
) {
  const env = getEnv();
  const key = `${currency}:${interval}`;
  const prices: Record<string, string> = {
    "cad:month": env.STRIPE_PRICE_CAD_MONTHLY,
    "cad:year": env.STRIPE_PRICE_CAD_YEARLY,
    "usd:month": env.STRIPE_PRICE_USD_MONTHLY,
    "usd:year": env.STRIPE_PRICE_USD_YEARLY,
  };
  const priceId = prices[key];
  if (!priceId) throw new Error(`Stripe price ${key} is not configured.`);
  return priceId;
}
