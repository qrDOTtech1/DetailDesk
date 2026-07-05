"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeSlots } from "@/lib/slots";
import { computeDeposit } from "@/lib/utils";
import { publicBookingSchema } from "@/lib/validators";
import { stripe, appUrl } from "@/lib/stripe";
import { sendEmail } from "@/lib/mailer";
import { bookingConfirmationEmail } from "@/lib/emails";
import { addMinutes } from "date-fns";

/**
 * Public booking flow. Runs with the service-role client because the end
 * customer has no account. Every query is scoped to the business resolved
 * from the public slug — never from client-provided business ids.
 */

async function getBusinessBySlug(slug: string) {
  const supabase = createAdminClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, email, phone, address, logo_url, cancellation_policy, stripe_connected, stripe_account_id, is_active")
    .eq("slug", slug).eq("is_active", true).maybeSingle();
  return business;
}

/** Available slot start times (ISO strings, UTC) for a service on a date. */
export async function getAvailableSlots(slug: string, serviceId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  const business = await getBusinessBySlug(slug);
  if (!business) return { error: "Business introuvable." };

  const supabase = createAdminClient();
  const [{ data: service }, { data: settings }, { data: rules }] = await Promise.all([
    supabase.from("services").select("duration_minutes")
      .eq("id", serviceId).eq("business_id", business.id).eq("is_active", true).maybeSingle(),
    supabase.from("business_settings").select("*").eq("business_id", business.id).maybeSingle(),
    supabase.from("availability_rules").select("weekday, start_time, end_time")
      .eq("business_id", business.id).eq("is_active", true),
  ]);
  if (!service) return { error: "Service introuvable." };

  const tz = settings?.timezone ?? "Europe/Paris";
  const dayStart = new Date(`${date}T00:00:00Z`);
  const windowStart = new Date(dayStart.getTime() - 24 * 3600_000).toISOString();
  const windowEnd = new Date(dayStart.getTime() + 48 * 3600_000).toISOString();

  const [{ data: bookings }, { data: blocked }] = await Promise.all([
    supabase.from("bookings").select("starts_at, ends_at")
      .eq("business_id", business.id).in("status", ["pending", "confirmed"])
      .gte("ends_at", windowStart).lte("starts_at", windowEnd),
    supabase.from("blocked_slots").select("starts_at, ends_at")
      .eq("business_id", business.id).gte("ends_at", windowStart).lte("starts_at", windowEnd),
  ]);

  const busy = [...(bookings ?? []), ...(blocked ?? [])].map((x) => ({
    start: new Date(x.starts_at), end: new Date(x.ends_at),
  }));

  const slots = computeSlots({
    date, timezone: tz,
    durationMinutes: service.duration_minutes,
    bufferMinutes: settings?.buffer_minutes ?? 15,
    noticeHours: settings?.booking_notice_hours ?? 12,
    rules: rules ?? [], busy,
  });
  return { slots: slots.map((s) => s.toISOString()), timezone: tz };
}

/** Creates the booking (+customer +vehicle). Returns checkout URL if a deposit is due. */
export async function createPublicBooking(slug: string, input: unknown) {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const business = await getBusinessBySlug(slug);
  if (!business) return { error: "Business introuvable." };

  const supabase = createAdminClient();
  const { data: service } = await supabase.from("services").select("*")
    .eq("id", d.service_id).eq("business_id", business.id).eq("is_active", true).maybeSingle();
  if (!service) return { error: "Service introuvable." };

  // Re-validate the requested slot server-side
  const starts = new Date(d.starts_at);
  const { data: settings } = await supabase.from("business_settings").select("*")
    .eq("business_id", business.id).maybeSingle();
  const tz = settings?.timezone ?? "Europe/Paris";
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(starts);
  const slotCheck = await getAvailableSlots(slug, service.id, dateStr);
  if ("error" in slotCheck && slotCheck.error) return { error: slotCheck.error };
  const ok = (slotCheck as { slots: string[] }).slots?.some(
    (s) => new Date(s).getTime() === starts.getTime()
  );
  if (!ok) return { error: "Ce créneau n'est plus disponible. Choisis-en un autre." };

  const ends = addMinutes(starts, service.duration_minutes);
  const deposit = computeDeposit(service);
  const depositActive = deposit > 0 && business.stripe_connected && business.stripe_account_id;

  // upsert customer by email within this business
  let customerId: string;
  const { data: existing } = await supabase.from("customers").select("id")
    .eq("business_id", business.id).eq("email", d.customer_email).maybeSingle();
  if (existing) {
    customerId = existing.id;
    await supabase.from("customers").update({
      full_name: d.customer_name, phone: d.customer_phone || null,
    }).eq("id", customerId);
  } else {
    const { data: created, error } = await supabase.from("customers").insert({
      business_id: business.id, full_name: d.customer_name,
      email: d.customer_email, phone: d.customer_phone || null,
    }).select("id").single();
    if (error || !created) return { error: "Erreur client." };
    customerId = created.id;
  }

  const { data: vehicle } = await supabase.from("vehicles").insert({
    business_id: business.id, customer_id: customerId,
    make: d.vehicle_make, model: d.vehicle_model,
    year: d.vehicle_year || null, size_category: d.vehicle_size ?? "other",
  }).select("id").single();

  const { data: booking, error: bookingErr } = await supabase.from("bookings").insert({
    business_id: business.id, service_id: service.id,
    customer_id: customerId, vehicle_id: vehicle?.id ?? null,
    status: "pending",
    starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    total_price_cents: service.price_cents,
    deposit_amount_cents: depositActive ? deposit : 0,
    deposit_paid: false,
    notes: d.notes || null,
  }).select("id, public_cancel_token").single();
  if (bookingErr || !booking) return { error: "Erreur lors de la réservation." };

  const cancelUrl = appUrl(`/cancel/${booking.public_cancel_token}`);

  if (depositActive) {
    // Checkout Session on the CONNECTED account (money goes to the pro).
    // application_fee_amount stays at 0 in V1 — platform fee ready for V2.
    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: d.customer_email,
          line_items: [{
            price_data: {
              currency: "eur",
              product_data: { name: `Acompte — ${service.name} (${business.name})` },
              unit_amount: deposit,
            },
            quantity: 1,
          }],
          payment_intent_data: { metadata: { booking_id: booking.id, business_id: business.id } },
          metadata: { booking_id: booking.id, business_id: business.id },
          success_url: appUrl(`/b/${slug}/confirmed/${booking.id}?paid=1`),
          cancel_url: appUrl(`/b/${slug}/confirmed/${booking.id}?paid=0`),
        },
        { stripeAccount: business.stripe_account_id! }
      );

      await supabase.from("payments").insert({
        business_id: business.id, booking_id: booking.id,
        stripe_checkout_session_id: session.id,
        stripe_connected_account_id: business.stripe_account_id,
        amount_cents: deposit, currency: "eur", status: "pending",
      });
      return { checkoutUrl: session.url, bookingId: booking.id };
    } catch (e) {
      console.error("[stripe] checkout create failed", e);
      // fall through: booking stands, deposit will be handled offline
    }
  }

  // no deposit — confirm immediately + send confirmation email
  await supabase.from("bookings").update({ status: "confirmed" }).eq("id", booking.id);
  const email = bookingConfirmationEmail({
    businessName: business.name, customerName: d.customer_name,
    serviceName: service.name, startsAt: starts.toISOString(), timezone: tz,
    totalCents: service.price_cents, depositCents: 0, cancelUrl,
  });
  await sendEmail({
    type: "booking_confirmation", to: d.customer_email, ...email,
    businessId: business.id, bookingId: booking.id,
  });
  return { bookingId: booking.id };
}
