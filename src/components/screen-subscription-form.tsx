"use client";

import { useMemo, useState } from "react";
import { CheckoutEmbed } from "@/components/embedded-checkout";
import { SCREEN_MONTHLY_PRICE } from "@/lib/stripe";

export function ScreenSubscriptionForm({
  currency,
  initialQuantity = 1,
  submitLabel = "Subscribe now",
}: {
  currency: "CAD" | "USD";
  initialQuantity?: number;
  submitLabel?: string;
}) {
  const [quantity, setQuantity] = useState(
    Math.max(1, Math.min(500, Math.trunc(initialQuantity))),
  );
  const [checkoutQuantity, setCheckoutQuantity] = useState<number | null>(null);
  const total = useMemo(
    () => Math.max(1, quantity) * SCREEN_MONTHLY_PRICE,
    [quantity],
  );

  return (
    <section className="panel billing-quantity">
      <h2>Screen subscription</h2>
      <p className="muted">
        {currency} ${SCREEN_MONTHLY_PRICE} per screen each month.
      </p>
      <div className="subscription-quote">
        <label>
          Screens
          <input
            type="number"
            min="1"
            max="500"
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value);
              setQuantity(
                Number.isInteger(next) ? Math.max(1, Math.min(500, next)) : 1,
              );
              setCheckoutQuantity(null);
            }}
          />
        </label>
        <span className="subscription-quote-times" aria-hidden>
          ×
        </span>
        <p className="subscription-quote-price">
          {currency} ${SCREEN_MONTHLY_PRICE}
        </p>
        <span className="subscription-quote-times" aria-hidden>
          =
        </span>
        <p className="subscription-quote-total">
          {currency} ${total}
          <small>/month</small>
        </p>
      </div>
      <button
        className="button"
        type="button"
        onClick={() => setCheckoutQuantity(quantity)}
      >
        {submitLabel}
      </button>
      {checkoutQuantity != null && (
        <div className="checkout-panel">
          <CheckoutEmbed quantity={checkoutQuantity} kind="subscribe" />
        </div>
      )}
    </section>
  );
}
