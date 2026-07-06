import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPortalSession } from "@/lib/portal-auth";

/** Consumes a single-use portal magic link and opens the portal session. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { origin } = new URL(request.url);
  if (!/^[0-9a-f-]{36}$/.test(token)) return NextResponse.redirect(`${origin}/`);

  const t = await db.portalLoginToken.findUnique({ where: { token } });
  if (!t || t.usedAt || t.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/?portal=expired`);
  }

  await db.portalLoginToken.update({ where: { token }, data: { usedAt: new Date() } });
  await createPortalSession(t.customerId, t.businessId);
  return NextResponse.redirect(`${origin}/portal`);
}
