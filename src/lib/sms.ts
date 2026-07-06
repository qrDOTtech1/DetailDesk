import { db } from "@/lib/db";

/**
 * SMS via ClickSend (platform account). Like the mailer: never throws,
 * always logged in sms_logs — a failed SMS must not break a flow.
 *
 * Billing model: each business includes `sms_quota_monthly` SMS per month
 * (default 150). Above quota, overage is billed 1€ per 10 SMS (rounded up),
 * computed from sms_logs — see getSmsUsage().
 */

export const SMS_OVERAGE_EUR_PER_10 = 1;

/** Normalizes FR numbers to E.164 (+33...). Returns null if unusable. */
export function normalizePhone(raw: string): string | null {
  const p = raw.replace(/[\s.\-()]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(p)) return p;
  if (/^0[1-9]\d{8}$/.test(p)) return "+33" + p.slice(1);
  if (/^33[1-9]\d{8}$/.test(p)) return "+" + p;
  return null;
}

type SendArgs = {
  to: string;
  body: string;
  businessId: string;
  bookingId?: string | null;
  type?: string;
};

export async function sendSms({ to, body, businessId, bookingId, type = "booking_reminder" }: SendArgs) {
  const phone = normalizePhone(to);
  let status = "sent";
  let clicksendId: string | null = null;

  if (!phone) {
    status = "failed: invalid_phone";
  } else if (!process.env.CLICKSEND_USERNAME || !process.env.CLICKSEND_API_KEY) {
    status = "skipped_no_api_key";
    console.log(`[sms/dev] ${type} -> ${phone}: ${body}`);
  } else {
    try {
      const auth = Buffer.from(
        `${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`
      ).toString("base64");
      const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          messages: [{ source: "detaildesk", to: phone, body: body.slice(0, 320) }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => null);
      const msg = data?.data?.messages?.[0];
      if (!res.ok || msg?.status !== "SUCCESS") {
        status = `failed: ${msg?.status ?? res.status}`.slice(0, 200);
      } else {
        clicksendId = msg?.message_id ?? null;
      }
    } catch (e) {
      status = `failed: ${e instanceof Error ? e.message : "unknown"}`.slice(0, 200);
    }
  }

  try {
    await db.smsLog.create({
      data: { businessId, bookingId: bookingId ?? null, recipient: phone ?? to, type, status, clicksendId },
    });
  } catch (e) {
    console.error("[sms] sms_logs insert failed", e);
  }
  return status === "sent";
}

/** Current-month usage + overage for a business. */
export async function getSmsUsage(businessId: string, quota: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sent = await db.smsLog.count({
    where: { businessId, createdAt: { gte: monthStart }, status: "sent" },
  });
  const overage = Math.max(0, sent - quota);
  const overageEur = Math.ceil(overage / 10) * SMS_OVERAGE_EUR_PER_10;
  return { sent, quota, overage, overageEur };
}
