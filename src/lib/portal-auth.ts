import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Client portal session — completely separate from the pro session.
 * Cookie payload is scoped to ONE customer of ONE business: the same email
 * at two businesses gets two independent portals, no cross-tenant leak.
 */
const PORTAL_COOKIE = "dd_portal";
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createPortalSession(customerId: string, businessId: string) {
  const token = await new SignJWT({ sub: customerId, biz: businessId, aud: "portal" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function destroyPortalSession() {
  (await cookies()).delete(PORTAL_COOKIE);
}

export async function getPortalSession(): Promise<{ customerId: string; businessId: string } | null> {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.aud !== "portal" || typeof payload.sub !== "string" || typeof payload.biz !== "string") return null;
    return { customerId: payload.sub, businessId: payload.biz };
  } catch {
    return null;
  }
}

/** Loads the portal customer + business or redirects to home. */
export async function requirePortalCustomer() {
  const session = await getPortalSession();
  if (!session) redirect("/");
  const customer = await db.customer.findFirst({
    where: { id: session.customerId, businessId: session.businessId },
    include: { business: { select: { id: true, name: true, slug: true, logoUrl: true, phone: true, email: true } } },
  });
  if (!customer) redirect("/");
  return customer;
}
