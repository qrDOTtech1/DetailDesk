"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPortalSession } from "@/lib/portal-auth";

/** Consumes the single-use token (POST only) and opens the portal session. */
export async function consumePortalToken(token: string) {
  if (!/^[0-9a-f-]{36}$/.test(token)) redirect("/");

  const t = await db.portalLoginToken.findUnique({ where: { token } });
  if (!t || t.usedAt || t.expiresAt < new Date()) redirect("/?portal=expired");

  await db.portalLoginToken.update({ where: { token }, data: { usedAt: new Date() } });
  await createPortalSession(t.customerId, t.businessId);
  redirect("/portal");
}
