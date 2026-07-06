import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Platform-account webhook. In V1 only account.updated matters here
 * (some Stripe setups deliver it on the platform endpoint too).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await db.business.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeConnected: Boolean(account.charges_enabled) },
      });
      break;
    }

    // ── Platform subscription lifecycle (29€/mois DetailDesk Pro) ──
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subId = typeof session.subscription === "string" ? session.subscription : null;
      if (customerId && subId) {
        await db.business.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionId: subId, subscriptionStatus: "trialing" },
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        await db.business.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionId: sub.id,
            subscriptionStatus: event.type.endsWith("deleted") ? "canceled" : sub.status,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
