"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mailer";
import { portalMagicLinkEmail } from "@/lib/emails";
import { appUrl } from "@/lib/stripe";

/**
 * Sends a portal magic link. Response is IDENTICAL whether the email exists
 * or not (no account enumeration).
 */
export async function requestPortalLink(slug: string, emailRaw: string) {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Email invalide." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`portal:${ip}`, 5, 3600_000) || !rateLimit(`portal:${email}`, 3, 3600_000)) {
    return { error: "Trop de demandes. Réessaie plus tard." };
  }

  const business = await db.business.findFirst({
    where: { slug, isActive: true }, select: { id: true, name: true },
  });
  if (!business) return { success: true }; // same response, no enumeration

  const customer = await db.customer.findFirst({
    where: { businessId: business.id, email },
  });
  if (customer) {
    const token = randomUUID();
    await db.portalLoginToken.create({
      data: {
        token, businessId: business.id, customerId: customer.id,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    const emailContent = portalMagicLinkEmail({
      businessName: business.name,
      loginUrl: appUrl(`/portal/login/${token}`),
    });
    await sendEmail({
      type: "welcome", to: email, ...emailContent,
      businessId: business.id,
    });
  }
  return { success: true };
}
