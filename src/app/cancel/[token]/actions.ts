"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
import { bookingCancelledEmail } from "@/lib/emails";

/** Secure public cancellation via the booking's unique token. */
export async function cancelBookingByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) return { error: "Lien invalide." };
  const supabase = createAdminClient();

  const { data: booking } = await supabase.from("bookings")
    .select("id, status, starts_at, business_id, total_price_cents, deposit_amount_cents, services(name), customers(full_name, email), businesses(name)")
    .eq("public_cancel_token", token).maybeSingle();
  if (!booking) return { error: "Réservation introuvable." };
  if (!["pending", "confirmed"].includes(booking.status)) return { error: "Déjà annulée ou terminée." };
  if (new Date(booking.starts_at) <= new Date()) return { error: "Le rendez-vous est déjà passé." };

  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);

  const customer = booking.customers as { full_name?: string; email?: string | null } | null;
  const { data: settings } = await supabase.from("business_settings")
    .select("timezone").eq("business_id", booking.business_id).maybeSingle();
  if (customer?.email) {
    const email = bookingCancelledEmail({
      businessName: (booking.businesses as { name?: string } | null)?.name ?? "Le pro",
      customerName: customer.full_name ?? "",
      serviceName: (booking.services as { name?: string } | null)?.name ?? "Service",
      startsAt: booking.starts_at,
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: booking.total_price_cents,
      depositCents: booking.deposit_amount_cents,
    });
    await sendEmail({
      type: "booking_cancelled", to: customer.email, ...email,
      businessId: booking.business_id, bookingId: booking.id,
    });
  }
  return { success: true };
}
