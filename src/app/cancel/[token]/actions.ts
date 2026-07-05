"use server";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { bookingCancelledEmail } from "@/lib/emails";

/** Secure public cancellation via the booking's unique token. */
export async function cancelBookingByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) return { error: "Lien invalide." };

  const booking = await db.booking.findUnique({
    where: { publicCancelToken: token },
    include: { service: true, customer: true, business: true },
  });
  if (!booking) return { error: "Réservation introuvable." };
  if (!["pending", "confirmed"].includes(booking.status)) return { error: "Déjà annulée ou terminée." };
  if (booking.startsAt <= new Date()) return { error: "Le rendez-vous est déjà passé." };

  await db.$transaction([
    db.booking.update({ where: { id: booking.id }, data: { status: "cancelled" } }),
    db.bookingStatusHistory.create({
      data: {
        businessId: booking.businessId, bookingId: booking.id,
        oldStatus: booking.status, newStatus: "cancelled",
      },
    }),
  ]);

  const settings = await db.businessSettings.findUnique({
    where: { businessId: booking.businessId }, select: { timezone: true },
  });
  if (booking.customer.email) {
    const email = bookingCancelledEmail({
      businessName: booking.business.name,
      customerName: booking.customer.fullName,
      serviceName: booking.service.name,
      startsAt: booking.startsAt.toISOString(),
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: booking.totalPriceCents,
      depositCents: booking.depositAmountCents,
    });
    await sendEmail({
      type: "booking_cancelled", to: booking.customer.email, ...email,
      businessId: booking.businessId, bookingId: booking.id,
    });
  }
  return { success: true };
}
