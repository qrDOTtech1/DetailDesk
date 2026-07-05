import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailType =
  | "welcome"
  | "booking_confirmation"
  | "payment_confirmation"
  | "booking_reminder"
  | "booking_cancelled";

type SendArgs = {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  businessId?: string | null;
  bookingId?: string | null;
};

/**
 * Sends a transactional email via Resend and logs it in email_logs.
 * NEVER throws — a failed email must not break a booking/payment flow.
 */
export async function sendEmail({ type, to, subject, html, businessId, bookingId }: SendArgs) {
  const supabase = createAdminClient();
  let resendId: string | null = null;
  let status = "sent";

  try {
    if (!process.env.RESEND_API_KEY) {
      status = "skipped_no_api_key";
      console.log(`[mailer/dev] ${type} -> ${to}: ${subject}`);
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "DetailDesk <onboarding@resend.dev>",
        to,
        subject,
        html,
      });
      if (error) {
        status = `failed: ${error.message}`.slice(0, 200);
      } else {
        resendId = data?.id ?? null;
      }
    }
  } catch (e) {
    status = `failed: ${e instanceof Error ? e.message : "unknown"}`.slice(0, 200);
  }

  try {
    await supabase.from("email_logs").insert({
      type,
      recipient: to,
      status,
      resend_id: resendId,
      business_id: businessId ?? null,
      booking_id: bookingId ?? null,
    });
  } catch (e) {
    console.error("[mailer] email_logs insert failed", e);
  }
}
