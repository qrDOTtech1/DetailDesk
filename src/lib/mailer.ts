import { Resend } from "resend";
import { db } from "@/lib/db";

export type EmailType =
  | "welcome"
  | "booking_confirmation"
  | "payment_confirmation"
  | "booking_reminder"
  | "booking_cancelled"
  | "review_request"
  | "rebooking_reminder"
  | "new_booking_pro"
  | "invoice_sent";

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
  let resendId: string | null = null;
  let status = "sent";

  // customer-facing emails sent on behalf of a business reply to the PRO,
  // not to our sending domain
  let replyTo: string | undefined;
  if (businessId && type !== "new_booking_pro" && type !== "welcome") {
    try {
      const biz = await db.business.findUnique({
        where: { id: businessId }, select: { email: true },
      });
      replyTo = biz?.email ?? undefined;
    } catch { /* non-blocking */ }
  }

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
        replyTo,
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
    await db.emailLog.create({
      data: {
        type, recipient: to, status,
        resendId, businessId: businessId ?? null, bookingId: bookingId ?? null,
      },
    });
  } catch (e) {
    console.error("[mailer] email_logs insert failed", e);
  }
}
