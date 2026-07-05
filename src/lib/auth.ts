import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export type SessionContext = {
  user: { id: string; email: string };
  profile: { id: string; email: string; full_name: string | null; platform_role: string | null };
};

export type BusinessContext = SessionContext & {
  business: {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone: string | null;
    address: string | null;
    business_type: string;
    logo_url: string | null;
    cancellation_policy: string | null;
    stripe_account_id: string | null;
    stripe_connected: boolean;
  };
  role: "owner" | "staff";
};

/** Sets the signed session cookie for a given profile. Call after signup/login. */
export async function createSession(profileId: string) {
  const token = await signSession(profileId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Returns the current profile id from the session cookie, or null. */
export async function getSessionProfileId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Requires a logged-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionContext> {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/login");

  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) redirect("/login");

  return {
    user: { id: profile.id, email: profile.email },
    profile: {
      id: profile.id, email: profile.email,
      full_name: profile.fullName, platform_role: profile.platformRole,
    },
  };
}

/** Requires user + a business membership; redirects to /onboarding if none. */
export async function requireBusiness(): Promise<BusinessContext> {
  const ctx = await requireUser();

  const membership = await db.businessMember.findFirst({
    where: { userId: ctx.user.id },
    include: { business: true },
  });
  if (!membership) redirect("/onboarding");

  const b = membership.business;
  return {
    ...ctx,
    role: membership.role,
    business: {
      id: b.id, name: b.name, slug: b.slug, email: b.email,
      phone: b.phone, address: b.address, business_type: b.businessType,
      logo_url: b.logoUrl, cancellation_policy: b.cancellationPolicy,
      stripe_account_id: b.stripeAccountId, stripe_connected: b.stripeConnected,
    },
  };
}

/** Requires platform_admin; redirects to /dashboard otherwise. */
export async function requirePlatformAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (ctx.profile.platform_role !== "platform_admin") redirect("/dashboard");
  return ctx;
}
