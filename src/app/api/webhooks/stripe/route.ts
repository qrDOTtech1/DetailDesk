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

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await db.business.updateMany({
      where: { stripeAccountId: account.id },
      data: { stripeConnected: Boolean(account.charges_enabled) },
    });
  }

  return NextResponse.json({ received: true });
}
