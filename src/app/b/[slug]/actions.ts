"use server";

import { db } from "@/lib/db";
import { computeSlots } from "@/lib/slots";
import { computeDeposit } from "@/lib/utils";
import { publicBookingSchema } from "@/lib/validators";
import { stripe, appUrl } from "@/lib/stripe";
import { sendEmail } from "@/lib/mailer";
import { bookingConfirmationEmail, newBookingProEmail } from "@/lib/emails";
import { addMinutes } from "date-fns";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public booking flow. The end customer has no account, so every query here
 * is scoped explicitly by the business resolved from the public slug —
 * never from a client-provided business id.
 */

async function getBusinessBySlug(slug: string) {
  return db.business.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true, name: true, slug: true, email: true, phone: true, address: true,
      logoUrl: true, cancellationPolicy: true, stripeConnected: true, stripeAccountId: true,
    },
  });
}

/** Available slot start times (ISO strings, UTC) for a service on a date. */
export async function getAvailableSlots(slug: string, serviceId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  const business = await getBusinessBySlug(slug);
  if (!business) return { error: "Business introuvable." };

  const [service, settings, rules] = await Promise.all([
    db.service.findFirst({
      where: { id: serviceId, businessId: business.id, isActive: true },
      select: { durationMinutes: true },
    }),
    db.businessSettings.findUnique({ where: { businessId: business.id } }),
    db.availabilityRule.findMany({
      where: { businessId: business.id, isActive: true },
      select: { weekday: true, startTime: true, endTime: true },
    }),
  ]);
  if (!service) return { error: "Service introuvable." };

  const tz = settings?.timezone ?? "Europe/Paris";
  const dayStart = new Date(`${date}T00:00:00Z`);
  const windowStart = new Date(dayStart.getTime() - 24 * 3600_000);
  const windowEnd = new Date(dayStart.getTime() + 48 * 3600_000);

  const [bookings, blocked] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId: business.id, status: { in: ["pending", "confirmed"] },
        endsAt: { gte: windowStart }, startsAt: { lte: windowEnd },
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.blockedSlot.findMany({
      where: { businessId: business.id, endsAt: { gte: windowStart }, startsAt: { lte: windowEnd } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const busy = [...bookings, ...blocked].map((x) => ({ start: x.startsAt, end: x.endsAt }));

  const slots = computeSlots({
    date, timezone: tz,
    durationMinutes: service.durationMinutes,
    bufferMinutes: settings?.bufferMinutes ?? 15,
    noticeHours: settings?.bookingNoticeHours ?? 12,
    rules: rules.map((r) => ({ weekday: r.weekday, start_time: r.startTime, end_time: r.endTime })),
    busy,
  });
  return { slots: slots.map((s) => s.toISOString()), timezone: tz };
}

/** Creates the booking (+customer +vehicle). Returns checkout URL if a deposit is due. */
export async function createPublicBooking(slug: string, input: unknown) {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = { ...parsed.data, customer_email: parsed.data.customer_email.toLowerCase() };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`book:${ip}`, 5, 3600_000) || !rateLimit(`book:${slug}`, 30, 3600_000)) {
    return { error: "Trop de réservations en peu de temps. Réessaie plus tard." };
  }

  const business = await getBusinessBySlug(slug);
  if (!business) return { error: "Business introuvable." };

  const service = await db.service.findFirst({
    where: { id: d.service_id, businessId: business.id, isActive: true },
  });
  if (!service) return { error: "Service introuvable." };

  // validate requested add-ons: must be active and belong to THIS service/business
  const addons = (d.addon_ids?.length ?? 0) > 0
    ? await db.serviceAddon.findMany({
        where: {
          id: { in: d.addon_ids! }, serviceId: service.id,
          businessId: business.id, isActive: true,
        },
      })
    : [];
  if (addons.length !== (d.addon_ids?.length ?? 0)) {
    return { error: "Option invalide, recharge la page." };
  }
  const addonsTotal = addons.reduce((s, a) => s + a.priceCents, 0);

  // promo code: active, in window, under usage limit — scoped to this business
  let promotion: { id: string; discountType: string; discountValue: number } | null = null;
  if (d.promo_code) {
    const code = d.promo_code.trim().toUpperCase();
    const promo = await db.promotion.findUnique({
      where: { businessId_code: { businessId: business.id, code } },
      include: { _count: { select: { redemptions: true } } },
    });
    const now = new Date();
    const valid = promo && promo.isActive
      && (!promo.startsAt || promo.startsAt <= now)
      && (!promo.endsAt || promo.endsAt >= now)
      && (!promo.usageLimit || promo._count.redemptions < promo.usageLimit);
    if (!valid) return { error: "Code promo invalide ou expiré." };
    promotion = promo;
  }

  const grossTotal = service.priceCents + addonsTotal;
  const discount = promotion
    ? Math.min(grossTotal, promotion.discountType === "fixed"
        ? promotion.discountValue
        : Math.round((grossTotal * promotion.discountValue) / 100))
    : 0;
  const netTotal = grossTotal - discount;

  // Re-validate the requested slot server-side
  const starts = new Date(d.starts_at);
  const settings = await db.businessSettings.findUnique({ where: { businessId: business.id } });
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

  const ends = addMinutes(starts, service.durationMinutes);
  const deposit = Math.min(netTotal, computeDeposit({
    deposit_required: service.depositRequired, deposit_type: service.depositType,
    deposit_value: service.depositValue, price_cents: service.priceCents,
  }));
  const depositActive = deposit > 0 && business.stripeConnected && business.stripeAccountId;

  // upsert customer by email within this business
  const existingCustomer = await db.customer.findFirst({
    where: { businessId: business.id, email: d.customer_email },
  });
  const customer = existingCustomer
    ? await db.customer.update({
        where: { id: existingCustomer.id },
        data: { fullName: d.customer_name, phone: d.customer_phone || null },
      })
    : await db.customer.create({
        data: {
          businessId: business.id, fullName: d.customer_name,
          email: d.customer_email, phone: d.customer_phone || null,
        },
      });

  // explicit marketing/public-photos consent collected in the booking flow
  if (d.consent_public_photos) {
    await db.customerConsent.upsert({
      where: { customerId_consentType: { customerId: customer.id, consentType: "public_photos" } },
      create: {
        businessId: business.id, customerId: customer.id, consentType: "public_photos",
        granted: true, grantedAt: new Date(), source: "public_booking",
      },
      update: { granted: true, grantedAt: new Date(), revokedAt: null, source: "public_booking" },
    });
  }

  // reuse the customer's existing vehicle instead of duplicating it per booking
  const existingVehicle = await db.vehicle.findFirst({
    where: {
      businessId: business.id, customerId: customer.id,
      make: { equals: d.vehicle_make, mode: "insensitive" },
      model: { equals: d.vehicle_model, mode: "insensitive" },
    },
  });
  const vehicle = existingVehicle ?? await db.vehicle.create({
    data: {
      businessId: business.id, customerId: customer.id,
      make: d.vehicle_make, model: d.vehicle_model,
      trim: d.vehicle_trim || null,
      year: d.vehicle_year || null, sizeCategory: d.vehicle_size ?? "other",
    },
  });

  // Serializable transaction + overlap re-check: two concurrent requests for
  // the same slot cannot both commit.
  let booking;
  try {
    booking = await db.$transaction(async (tx) => {
      const clash = await tx.booking.count({
        where: {
          businessId: business.id,
          status: { in: ["pending", "confirmed"] },
          startsAt: { lt: ends },
          endsAt: { gt: starts },
        },
      });
      if (clash > 0) throw new Error("SLOT_TAKEN");
      const created = await tx.booking.create({
        data: {
          businessId: business.id, serviceId: service.id,
          customerId: customer.id, vehicleId: vehicle.id,
          status: "pending",
          startsAt: starts, endsAt: ends,
          totalPriceCents: netTotal,
          depositAmountCents: depositActive ? deposit : 0,
          depositPaid: false,
          promotionId: promotion?.id ?? null,
          discountCents: discount,
          notes: d.notes || null,
        },
      });
      if (promotion) {
        await tx.promotionRedemption.create({
          data: { businessId: business.id, promotionId: promotion.id, bookingId: created.id },
        });
      }
      if (addons.length > 0) {
        // snapshot name+price so later addon edits don't rewrite history
        await tx.bookingAddon.createMany({
          data: addons.map((a) => ({
            businessId: business.id, bookingId: created.id,
            name: a.name, priceCents: a.priceCents,
          })),
        });
      }
      await tx.bookingStatusHistory.create({
        data: { businessId: business.id, bookingId: created.id, oldStatus: null, newStatus: "pending" },
      });
      return created;
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return { error: "Ce créneau vient d'être réservé. Choisis-en un autre." };
    }
    // serialization conflict = concurrent booking on the same rows
    return { error: "Ce créneau vient d'être réservé. Choisis-en un autre." };
  }

  const cancelUrl = appUrl(`/cancel/${booking.publicCancelToken}`);

  // notify the PRO — they must not have to poll their dashboard
  await sendEmail({
    type: "new_booking_pro", to: business.email,
    ...newBookingProEmail({
      customerName: d.customer_name, customerPhone: d.customer_phone || null,
      serviceName: service.name, startsAt: starts.toISOString(), timezone: tz,
      totalCents: netTotal, depositCents: depositActive ? deposit : 0, depositPaid: false,
      vehicle: `${d.vehicle_make} ${d.vehicle_model}`,
      dashboardUrl: appUrl(`/dashboard/bookings/${booking.id}`),
    }),
    businessId: business.id, bookingId: booking.id,
  });

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
        { stripeAccount: business.stripeAccountId! }
      );

      await db.payment.create({
        data: {
          businessId: business.id, bookingId: booking.id,
          stripeCheckoutSessionId: session.id,
          stripeConnectedAccountId: business.stripeAccountId,
          amountCents: deposit, currency: "eur", status: "pending",
        },
      });
      return { checkoutUrl: session.url, bookingId: booking.id };
    } catch (e) {
      console.error("[stripe] checkout create failed", e);
      // Stripe failed mid-flow: keep the booking but clear the phantom
      // deposit so the dashboard doesn't show an unpayable "deposit pending".
      await db.booking.update({
        where: { id: booking.id },
        data: { depositAmountCents: 0 },
      });
    }
  }

  // no deposit — confirm immediately + send confirmation email
  await db.booking.update({ where: { id: booking.id }, data: { status: "confirmed" } });
  const email = bookingConfirmationEmail({
    businessName: business.name, customerName: d.customer_name,
    serviceName: service.name, startsAt: starts.toISOString(), timezone: tz,
    totalCents: netTotal, depositCents: 0, cancelUrl,
  });
  await sendEmail({
    type: "booking_confirmation", to: d.customer_email, ...email,
    businessId: business.id, bookingId: booking.id,
  });
  return { bookingId: booking.id };
}
