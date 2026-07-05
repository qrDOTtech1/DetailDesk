import Stripe from "stripe";

/** Platform Stripe client (DetailDesk keys). Connected-account calls pass { stripeAccount }. */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export function appUrl(path = "") {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}
