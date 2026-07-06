import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { bookingReminderEmail } from "@/lib/emails";
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

  return NextResponse.json({ ok: true, checked: bookings.length, sent, expired: stale.length });
}
