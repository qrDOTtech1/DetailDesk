import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { bookingReminderEmail, reviewRequestEmail, rebookingEmail } from "@/lib/emails";
import { appUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Reminder cron — call hourly:
 *   GET /api/cron/reminders  with header  Authorization: Bearer <CRON_SECRET>
 * Sends the reminder email once per booking when now >= starts_at - reminder_hours_before.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 72 * 3600_000); // look 72h ahead max

  // Expire abandoned deposit checkouts: pending + unpaid deposit + older than
  // 2h → cancel so the slot is freed (Stripe Checkout expires at 24h anyway).
  const stale = await db.booking.findMany({
    where: {
      status: "pending", depositPaid: false, depositAmountCents: { gt: 0 },
      createdAt: { lt: new Date(now.getTime() - 2 * 3600_000) },
    },
    select: { id: true, businessId: true },
  });
  for (const b of stale) {
    await db.$transaction([
      db.booking.update({ where: { id: b.id }, data: { status: "cancelled" } }),
      db.bookingStatusHistory.create({
        data: { businessId: b.businessId, bookingId: b.id, oldStatus: "pending", newStatus: "cancelled" },
      }),
    ]);
  }

  const bookings = await db.booking.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      startsAt: { gte: now, lte: horizon },
    },
    include: { service: true, customer: true, business: true, reminder: true },
  });

  let sent = 0;
  for (const b of bookings) {
    if (!b.customer.email) continue;
    if (b.reminder) continue;

    const settings = await db.businessSettings.findUnique({ where: { businessId: b.businessId } });
    const hoursBefore = settings?.reminderHoursBefore ?? 24;
    const sendAt = new Date(b.startsAt.getTime() - hoursBefore * 3600_000);
    if (now < sendAt) continue;

    const email = bookingReminderEmail({
      businessName: b.business.name,
      customerName: b.customer.fullName,
      serviceName: b.service.name,
      startsAt: b.startsAt.toISOString(),
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: b.totalPriceCents,
      depositCents: b.depositAmountCents,
      cancelUrl: appUrl(`/cancel/${b.publicCancelToken}`),
    }, settings?.reminderMessage);

    await sendEmail({
      type: "booking_reminder", to: b.customer.email, ...email,
      businessId: b.businessId, bookingId: b.id,
    });
    await db.bookingReminder.create({ data: { bookingId: b.id } });
    sent++;
  }

  // ── Google review requests: completed in the last 7 days, business has a
  // review URL configured, not already requested for this booking.
  let reviews = 0;
  const reviewCandidates = await db.booking.findMany({
    where: {
      status: "completed", reviewRequestSentAt: null,
      endsAt: { lte: now, gte: new Date(now.getTime() - 7 * 24 * 3600_000) },
    },
    include: { service: true, customer: true, business: { include: { settings: true } } },
    take: 200,
  });
  for (const b of reviewCandidates) {
    const url = b.business.settings?.googleReviewUrl;
    if (!url || !b.customer.email) continue;
    const email = reviewRequestEmail({
      businessName: b.business.name, customerName: b.customer.fullName,
      serviceName: b.service.name, reviewUrl: url,
    });
    await sendEmail({ type: "review_request", to: b.customer.email, ...email, businessId: b.businessId, bookingId: b.id });
    await db.booking.update({ where: { id: b.id }, data: { reviewRequestSentAt: now } });
    reviews++;
  }

  // ── Rebooking reminders: service has rebook_after_days, completed booking
  // older than that, not already reminded, within a 45-day catch-up window.
  let rebookings = 0;
  const rebookCandidates = await db.booking.findMany({
    where: {
      status: "completed", rebookingReminderSentAt: null,
      service: { rebookAfterDays: { not: null } },
    },
    include: { service: true, customer: true, business: true },
    take: 500,
  });
  for (const b of rebookCandidates) {
    const days = b.service.rebookAfterDays!;
    const dueAt = new Date(b.endsAt.getTime() + days * 24 * 3600_000);
    const windowEnd = new Date(dueAt.getTime() + 45 * 24 * 3600_000);
    if (now < dueAt || now > windowEnd || !b.customer.email) continue;
    // skip if the customer already has an upcoming booking with this business
    const upcoming = await db.booking.count({
      where: {
        businessId: b.businessId, customerId: b.customerId,
        status: { in: ["pending", "confirmed"] }, startsAt: { gte: now },
      },
    });
    if (upcoming > 0) {
      await db.booking.update({ where: { id: b.id }, data: { rebookingReminderSentAt: now } });
      continue;
    }
    const email = rebookingEmail({
      businessName: b.business.name, customerName: b.customer.fullName,
      serviceName: b.service.name, days,
      bookingUrl: appUrl(`/b/${b.business.slug}`),
    });
    await sendEmail({ type: "rebooking_reminder", to: b.customer.email, ...email, businessId: b.businessId, bookingId: b.id });
    await db.booking.update({ where: { id: b.id }, data: { rebookingReminderSentAt: now } });
    rebookings++;
  }

  return NextResponse.json({
    ok: true, checked: bookings.length, sent, expired: stale.length, reviews, rebookings,
  });
}
