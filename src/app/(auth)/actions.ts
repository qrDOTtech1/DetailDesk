"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getSessionProfileId } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { welcomeEmail, passwordResetEmail } from "@/lib/emails";
import { appUrl } from "@/lib/stripe";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères minimum"),
  full_name: z.string().max(100).optional(),
});

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function signUp(_prev: unknown, formData: FormData) {
  const parsed = credsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, full_name } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (!rateLimit(`signup:${await clientIp()}`, 5, 3600_000)) {
    return { error: "Trop de tentatives. Réessaie plus tard." };
  }

  const existing = await db.profile.findUnique({ where: { email } });
  if (existing) return { error: "Un compte existe déjà avec cet email." };

  const passwordHash = await bcrypt.hash(password, 10);
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  const profile = await db.profile.create({
    data: {
      email, passwordHash, fullName: full_name ?? "",
      platformRole: admins.includes(email.toLowerCase()) ? "platform_admin" : null,
    },
  });

  await sendEmail({ type: "welcome", to: email, ...welcomeEmail(full_name ?? "") });
  await createSession(profile.id);
  redirect("/onboarding");
}

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!rateLimit(`login:${await clientIp()}`, 10, 900_000) || !rateLimit(`login:${email}`, 5, 900_000)) {
    return { error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const profile = await db.profile.findUnique({ where: { email } });
  if (!profile || !(await bcrypt.compare(password, profile.passwordHash))) {
    return { error: "Identifiants invalides." };
  }
  await createSession(profile.id);
  redirect(String(formData.get("next") || "/dashboard"));
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function resetPassword(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  if (!email.includes("@")) return { error: "Email invalide." };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 3600_000)) {
    return { error: "Trop de tentatives. Réessaie plus tard." };
  }

  const profile = await db.profile.findUnique({ where: { email } });
  if (profile) {
    const token = randomUUID();
    await db.passwordResetToken.create({
      data: { token, profileId: profile.id, expiresAt: new Date(Date.now() + 3600_000) },
    });
    const url = appUrl(`/reset-password/${token}`);
    await sendEmail({ type: "welcome", to: email, ...passwordResetEmail(url) });
  }
  return { success: "Si ce compte existe, un email de réinitialisation a été envoyé." };
}

export async function updatePasswordWithToken(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };

  const reset = await db.passwordResetToken.findUnique({ where: { token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { error: "Lien invalide ou expiré." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction([
    db.profile.update({ where: { id: reset.profileId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
  ]);
  await createSession(reset.profileId);
  redirect("/dashboard");
}

export async function updatePassword(_prev: unknown, formData: FormData) {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/login");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.profile.update({ where: { id: profileId }, data: { passwordHash } });
  redirect("/dashboard");
}
