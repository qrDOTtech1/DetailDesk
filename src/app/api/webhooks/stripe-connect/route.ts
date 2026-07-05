import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, appUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const supabase = createAdminClient();

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await supabase.from("businesses")
        .update({ stripe_connected: Boolean(account.charges_enabled) })
        .eq("stripe_account_id", account.id);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const businessId = session.metadata?.business_id;
      if (!bookingId || !businessId) break;

      await supabase.from("payments").update({
        status: "succeeded",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      }).eq("stripe_checkout_session_id", session.id).eq("business_id", businessId);

      const { data: booking } = await supabase.from("bookings")
        .select("*, services(name), customers(full_name, email), businesses(name)")
        .eq("id", bookingId).eq("business_id", businessId).maybeSingle();
      if (!booking) break;

      await supabase.from("bookings")
        .update({ deposit_paid: true, status: booking.status === "pending" ? "confirmed" : booking.status })
        .eq("id", bookingId).eq("business_id", businessId);

      const customer = booking.customers as { full_name?: string; email?: string | null } | null;
      if (customer?.email) {
        const { data: settings } = await supabase.from("business_settings")
          .select("timezone").eq("business_id", businessId).maybeSingle();
        const info = {
          businessName: (booking.businesses as { name?: string } | null)?.name ?? "",
          customerName: customer.full_name ?? "",
          serviceName: (booking.services as { name?: string } | null)?.name ?? "Service",
          startsAt: booking.starts_at,
          timezone: settings?.timezone ?? "Europe/Paris",
          totalCents: booking.total_price_cents,
          depositCents: booking.deposit_amount_cents,
          cancelUrl: appUrl(`/cancel/${booking.public_cancel_token}`),
        };
        await sendEmail({ type: "payment_confirmation", to: customer.email, ...paymentConfirmationEmail(info), businessId, bookingId });
        await sendEmail({ type: "booking_confirmation", to: customer.email, ...bookingConfirmationEmail(info), businessId, bookingId });
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase.from("payments").update({ status: "cancelled" })
        .eq("stripe_checkout_session_id", session.id);
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase.from("payments").update({ status: "failed" })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
