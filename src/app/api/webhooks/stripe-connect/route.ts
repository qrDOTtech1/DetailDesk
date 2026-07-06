import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, appUrl } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { bookingConfirmationEmail, paymentConfirmationEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/**
 * Connect webhook — events from connected accounts (checkout, payments)
 * and account.updated for onboarding status.
 * Configure in Stripe Dashboard with "Listen to events on connected accounts".
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!);
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

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const businessId = session.metadata?.business_id;
      if (!bookingId || !businessId) break;

      await db.payment.updateMany({
        where: { stripeCheckoutSessionId: session.id, businessId },
        data: {
          status: "succeeded",
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });

      const booking = await db.booking.findFirst({
        where: { id: bookingId, businessId },
        include: { service: true, customer: true, business: true },
      });
      if (!booking) break;

      await db.booking.update({
        where: { id: bookingId },
        data: { depositPaid: true, status: booking.status === "pending" ? "confirmed" : booking.status },
      });

      // Stripe retries webhooks — don't send duplicate emails for the same booking
      const alreadySent = await db.emailLog.count({
        where: { bookingId, type: "payment_confirmation", status: { not: { startsWith: "failed" } } },
      });
      if (booking.customer.email && alreadySent === 0) {
        const settings = await db.businessSettings.findUnique({ where: { businessId }, select: { timezone: true } });
        const info = {
          businessName: booking.business.name,
          customerName: booking.customer.fullName,
          serviceName: booking.service.name,
          startsAt: booking.startsAt.toISOString(),
          timezone: settings?.timezone ?? "Europe/Paris",
          totalCents: booking.totalPriceCents,
          depositCents: booking.depositAmountCents,
          cancelUrl: appUrl(`/cancel/${booking.publicCancelToken}`),
        };
        await sendEmail({ type: "payment_confirmation", to: booking.customer.email, ...paymentConfirmationEmail(info), businessId, bookingId });
        await sendEmail({ type: "booking_confirmation", to: booking.customer.email, ...bookingConfirmationEmail(info), businessId, bookingId });
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await db.payment.updateMany({
        where: { stripeCheckoutSessionId: session.id }, data: { status: "cancelled" },
      });
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db.payment.updateMany({
        where: { stripePaymentIntentId: pi.id }, data: { status: "failed" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
