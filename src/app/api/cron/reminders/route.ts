import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const supabase = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 72 * 3600_000); // look 72h ahead max

  const { data: bookings, error } = await supabase.from("bookings")
    .select("id, business_id, starts_at, total_price_cents, deposit_amount_cents, public_cancel_token, services(name), customers(full_name, email), businesses(name)")
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const b of bookings ?? []) {
    const customer = b.customers as { full_name?: string; email?: string | null } | null;
    if (!customer?.email) continue;

    const { data: already } = await supabase.from("booking_reminders")
      .select("booking_id").eq("booking_id", b.id).maybeSingle();
    if (already) continue;

    const { data: settings } = await supabase.from("business_settings")
      .select("timezone, reminder_hours_before, reminder_message")
      .eq("business_id", b.business_id).maybeSingle();
    const hoursBefore = settings?.reminder_hours_before ?? 24;
    const sendAt = new Date(new Date(b.starts_at).getTime() - hoursBefore * 3600_000);
    if (now < sendAt) continue;

    const email = bookingReminderEmail({
      businessName: (b.businesses as { name?: string } | null)?.name ?? "",
      customerName: customer.full_name ?? "",
      serviceName: (b.services as { name?: string } | null)?.name ?? "Service",
      startsAt: b.starts_at,
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: b.total_price_cents,
      depositCents: b.deposit_amount_cents,
      cancelUrl: appUrl(`/cancel/${b.public_cancel_token}`),
    }, settings?.reminder_message);

    await sendEmail({
      type: "booking_reminder", to: customer.email, ...email,
      businessId: b.business_id, bookingId: b.id,
    });
    await supabase.from("booking_reminders").insert({ booking_id: b.id });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: bookings?.length ?? 0, sent });
}
