import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Platform Stripe client (DetailDesk keys), created lazily on first use.
 * Next.js evaluates route modules during "Collecting page data" at build
 * time, before runtime env vars are necessarily available — instantiating
 * Stripe eagerly at module scope crashes that step. Connected-account
 * calls pass { stripeAccount }.
 */
function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeClient(), prop, receiver);
  },
});

export function appUrl(path = "") {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}
