"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createEmbeddedCheckout } from "@/app/dashboard/billing/actions";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

export function CheckoutEmbed({
  quantity,
  kind = "subscribe",
}: {
  quantity: number;
  kind?: "subscribe" | "license_increase";
}) {
  return (
    <EmbeddedCheckoutProvider
      key={`${kind}-${quantity}`}
      stripe={stripePromise}
      options={{
        fetchClientSecret: () =>
          createEmbeddedCheckout({ quantity, kind }),
      }}
    >
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
