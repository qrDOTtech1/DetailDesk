import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

/** Requires a logged-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return { user: { id: user.id, email: user.email ?? "" }, profile };
}

/** Requires user + a business membership; redirects to /onboarding if none. */
export async function requireBusiness(): Promise<BusinessContext> {
  const ctx = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("business_members")
    .select("role, businesses(*)")
    .eq("user_id", ctx.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.businesses) redirect("/onboarding");
  return {
    ...ctx,
    business: membership.businesses as unknown as BusinessContext["business"],
    role: membership.role as "owner" | "staff",
  };
}

/** Requires platform_admin; redirects to /dashboard otherwise. */
export async function requirePlatformAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (ctx.profile.platform_role !== "platform_admin") redirect("/dashboard");
  return ctx;
}
