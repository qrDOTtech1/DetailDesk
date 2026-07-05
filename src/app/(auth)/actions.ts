"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
import { welcomeEmail } from "@/lib/emails";
import { appUrl } from "@/lib/stripe";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères minimum"),
  full_name: z.string().max(100).optional(),
});

export async function signUp(_prev: unknown, formData: FormData) {
  const parsed = credsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, full_name } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: full_name ?? "" }, emailRedirectTo: appUrl("/auth/callback") },
  });
  if (error) return { error: error.message };

  // Auto-grant platform_admin from allowlist
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (data.user && admins.includes(email.toLowerCase())) {
    const admin = createAdminClient();
    await admin.from("profiles").upsert({
      id: data.user.id, email, full_name: full_name ?? "", platform_role: "platform_admin",
    });
  }

  await sendEmail({ type: "welcome", to: email, ...welcomeEmail(full_name ?? "") });

  // If email confirmation is disabled, a session exists — go straight to onboarding.
  if (data.session) redirect("/onboarding");
  return { success: "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse." };
}

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Identifiants invalides." };
  redirect(String(formData.get("next") || "/dashboard"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resetPassword(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!email.includes("@")) return { error: "Email invalide." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl("/auth/callback?next=/update-password"),
  });
  if (error) return { error: error.message };
  return { success: "Email de réinitialisation envoyé (si le compte existe)." };
}

export async function updatePassword(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
