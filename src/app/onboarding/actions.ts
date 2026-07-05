"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessSchema } from "@/lib/validators";

export async function createBusiness(_prev: unknown, formData: FormData) {
  const ctx = await requireUser();
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // one business per user in V1
  const existing = await db.businessMember.findFirst({ where: { userId: ctx.user.id } });
  if (existing) redirect("/dashboard");

  const slugTaken = await db.business.findUnique({ where: { slug: d.slug } });
  if (slugTaken) return { error: "Ce slug est déjà pris, choisis-en un autre." };

  const business = await db.business.create({
    data: {
      name: d.name, slug: d.slug, email: d.email,
      phone: d.phone || null, address: d.address || null,
      businessType: d.business_type, logoUrl: d.logo_url || null,
      cancellationPolicy: d.cancellation_policy || null,
    },
  });

  await db.businessMember.create({
    data: { businessId: business.id, userId: ctx.user.id, role: "owner" },
  });
  await db.businessSettings.create({ data: { businessId: business.id } });
  // default availability: Mon–Sat 9:00–18:00
  await db.availabilityRule.createMany({
    data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      businessId: business.id, weekday, startTime: "09:00", endTime: "18:00",
    })),
  });

  redirect("/dashboard");
}
